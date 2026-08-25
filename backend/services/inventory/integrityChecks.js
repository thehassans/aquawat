import { D, decStr } from '../../utils/decimal.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvMoveLine from '../../models/inventory/InvMoveLine.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvValuationLayer from '../../models/inventory/InvValuationLayer.js';
import InvSequence from '../../models/inventory/InvSequence.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import Product from '../../models/Product.js';
import InvProductStockCache from '../../models/inventory/InvProductStockCache.js';
import { toObjectId } from '../../models/inventory/common.js';
import { computeMoveDoneChecksum, computeMoveLineDoneChecksum } from './doneChecksum.js';

const SAMPLE = 2000;

function fail(code, message, messageAr, ref = {}) {
  return {
    type: 'integrity',
    code,
    severity: 'error',
    message,
    messageAr: messageAr || message,
    at: new Date(),
    ref,
    suggestedAction: 'Use a reversing move — never edit done ledger rows directly',
    suggestedActionAr: 'استخدم حركة عكسية — لا تعدّل سجلات الحركات المكتملة مباشرة',
  };
}

/**
 * §3.6 invariant suite. Returns structured failures (empty = healthy).
 * Sample-capped for large tenants; full scan when under SAMPLE quants.
 */
export async function runIntegrityChecks(tenantId, { limit = SAMPLE } = {}) {
  const tid = toObjectId(tenantId);
  const cap = Math.min(Number(limit) || SAMPLE, 5000);
  const failures = [];
  const started = Date.now();
  const checks = {};

  const locations = await InvLocation.find({ tenantId: tid }).select('_id usage completePath').lean();
  const locById = new Map(locations.map((l) => [String(l._id), l]));
  const internalIds = locations.filter((l) => l.usage === 'internal').map((l) => l._id);
  const viewIds = locations.filter((l) => l.usage === 'view').map((l) => l._id);

  // ── 2) reserved ≤ quantity ───────────────────────────────────────
  {
    const bad = await InvQuant.find({
      tenantId: tid,
      $expr: { $gt: ['$reservedQuantityNum', '$quantityNum'] },
    }).limit(50).select('productId locationId quantity reservedQuantity').lean();
    checks.reservedLteQuantity = { ok: bad.length === 0, count: bad.length };
    for (const q of bad) {
      failures.push(fail(
        'RESERVED_GT_QUANTITY',
        `Reserved ${q.reservedQuantity} > on-hand ${q.quantity}`,
        `المحجوز أكبر من الرصيد`,
        { productId: q.productId, locationId: q.locationId, quantId: q._id },
      ));
    }
  }

  // ── 7) no quants in view locations ───────────────────────────────
  {
    let viewCount = 0;
    if (viewIds.length) {
      viewCount = await InvQuant.countDocuments({
        tenantId: tid,
        locationId: { $in: viewIds },
        quantityNum: { $ne: 0 },
      });
      const samples = await InvQuant.find({
        tenantId: tid,
        locationId: { $in: viewIds },
        quantityNum: { $ne: 0 },
      }).limit(20).lean();
      for (const q of samples) {
        const loc = locById.get(String(q.locationId));
        failures.push(fail(
          'QUANT_IN_VIEW_LOCATION',
          `Non-zero quant in view location ${loc?.completePath || q.locationId}`,
          `رصيد في موقع عرض`,
          { quantId: q._id, locationId: q.locationId, productId: q.productId },
        ));
      }
    }
    checks.noQuantsInView = { ok: viewCount === 0, count: viewCount };
  }

  // ── 6) orphan move lines ─────────────────────────────────────────
  {
    const lineMoveIds = await InvMoveLine.distinct('moveId', { tenantId: tid });
    const existing = new Set(
      (await InvMove.find({ tenantId: tid, _id: { $in: lineMoveIds } }).select('_id').lean())
        .map((m) => String(m._id)),
    );
    const orphans = lineMoveIds.filter((id) => !existing.has(String(id))).slice(0, 40);
    checks.orphanMoveLines = { ok: orphans.length === 0, count: orphans.length };
    for (const moveId of orphans) {
      failures.push(fail(
        'ORPHAN_MOVE_LINE',
        `Move line(s) reference missing move ${moveId}`,
        `سطر حركة بلا حركة أصل`,
        { moveId },
      ));
    }
  }

  // ── 3) Σ reserved quants == Σ reserved on open move lines ────────
  {
    const [quantRes, lineRes] = await Promise.all([
      InvQuant.aggregate([
        { $match: { tenantId: tid } },
        { $group: { _id: null, reserved: { $sum: '$reservedQuantityNum' } } },
      ]),
      InvMoveLine.aggregate([
        {
          $match: {
            tenantId: tid,
            state: { $nin: ['done', 'cancelled'] },
          },
        },
        { $group: { _id: null, reserved: { $sum: '$quantityInProductUomNum' } } },
      ]),
    ]);
    const qRes = D(quantRes[0]?.reserved?.toString?.() || '0');
    const lRes = D(lineRes[0]?.reserved?.toString?.() || '0');
    // Allow tiny float noise
    const drift = qRes.minus(lRes).abs();
    const ok = drift.lte(D('0.0001'));
    checks.reservedBalance = {
      ok,
      quantReserved: decStr(qRes),
      lineReserved: decStr(lRes),
    };
    if (!ok) {
      failures.push(fail(
        'RESERVED_IMBALANCE',
        `Quant reserved ${decStr(qRes)} ≠ open move-line qty ${decStr(lRes)}`,
        `عدم تطابق المحجوز بين الكميات وأسطر الحركات`,
        { quantReserved: decStr(qRes), lineReserved: decStr(lRes) },
      ));
    }
  }

  // ── 1) move deltas == quant (sampled) ────────────────────────────
  {
    const quants = await InvQuant.find({
      tenantId: tid,
      locationId: { $in: internalIds },
    }).select('productId locationId quantity').limit(cap).lean();

    let mismatch = 0;
    // Batch move-line sums for sampled product+location pairs
    const productIds = [...new Set(quants.map((q) => String(q.productId)))].map((id) => toObjectId(id));
    const locIds = [...new Set(quants.map((q) => String(q.locationId)))].map((id) => toObjectId(id));

    const [ins, outs] = await Promise.all([
      InvMoveLine.aggregate([
        {
          $match: {
            tenantId: tid,
            state: 'done',
            productId: { $in: productIds },
            destLocationId: { $in: locIds },
          },
        },
        {
          $group: {
            _id: { productId: '$productId', locationId: '$destLocationId' },
            qty: { $sum: '$quantityInProductUomNum' },
          },
        },
      ]),
      InvMoveLine.aggregate([
        {
          $match: {
            tenantId: tid,
            state: 'done',
            productId: { $in: productIds },
            sourceLocationId: { $in: locIds },
          },
        },
        {
          $group: {
            _id: { productId: '$productId', locationId: '$sourceLocationId' },
            qty: { $sum: '$quantityInProductUomNum' },
          },
        },
      ]),
    ]);

    const inMap = new Map(ins.map((r) => [`${r._id.productId}:${r._id.locationId}`, D(r.qty?.toString?.() || '0')]));
    const outMap = new Map(outs.map((r) => [`${r._id.productId}:${r._id.locationId}`, D(r.qty?.toString?.() || '0')]));

    for (const q of quants) {
      const key = `${q.productId}:${q.locationId}`;
      const expected = (inMap.get(key) || D(0)).minus(outMap.get(key) || D(0));
      const actual = D(q.quantity || 0);
      if (!expected.eq(actual)) {
        mismatch += 1;
        if (failures.filter((f) => f.code === 'MOVE_DELTA_VS_QUANT').length < 30) {
          failures.push(fail(
            'MOVE_DELTA_VS_QUANT',
            `Ledger net ${decStr(expected)} ≠ quant ${decStr(actual)}`,
            `صافي الحركات لا يطابق الرصيد`,
            {
              productId: q.productId,
              locationId: q.locationId,
              expected: decStr(expected),
              actual: decStr(actual),
            },
          ));
        }
      }
    }
    checks.moveDeltaVsQuant = { ok: mismatch === 0, sampled: quants.length, mismatch };
  }

  // ── 4 & 5) stock value vs layers (sampled products) ──────────────
  {
    const productIds = await InvQuant.distinct('productId', {
      tenantId: tid,
      locationId: { $in: internalIds },
    });
    const sampleIds = productIds.slice(0, Math.min(200, productIds.length));
    const layerAgg = await InvValuationLayer.aggregate([
      { $match: { tenantId: tid, productId: { $in: sampleIds } } },
      {
        $group: {
          _id: '$productId',
          remainingValue: { $sum: '$remainingValueNum' },
          value: { $sum: '$valueNum' },
        },
      },
    ]);
    const layerMap = new Map(layerAgg.map((r) => [String(r._id), r]));
    let valueMismatch = 0;
    for (const pid of sampleIds) {
      const layer = layerMap.get(String(pid));
      const rem = D(layer?.remainingValue?.toString?.() || '0');
      const journal = D(layer?.value?.toString?.() || '0');
      // When FIFO remaining is tracked, rem should be non-negative; journal can diverge for average
      if (rem.lt(0)) {
        valueMismatch += 1;
        failures.push(fail(
          'NEGATIVE_LAYER_REMAINING',
          `Product ${pid} has negative remaining valuation`,
          `قيمة متبقية سالبة`,
          { productId: pid, remainingValue: decStr(rem) },
        ));
      }
      void journal;
    }
    checks.valuationLayers = { ok: valueMismatch === 0, sampled: sampleIds.length, mismatch: valueMismatch };
  }

  // ── 8) ProductStockCache vs ledger (sampled, batched per warehouse) ─
  {
    const caches = await InvProductStockCache.find({ tenantId: tid }).limit(300).lean();
    const byWh = new Map();
    for (const c of caches) {
      const wh = String(c.warehouseId || 'none');
      if (!byWh.has(wh)) byWh.set(wh, []);
      byWh.get(wh).push(c);
    }
    let cacheMismatch = 0;
    for (const [wh, rows] of byWh) {
      const locFilter = {
        tenantId: tid,
        usage: 'internal',
        active: true,
      };
      if (wh !== 'none') locFilter.warehouseId = toObjectId(wh);
      const locs = await InvLocation.find(locFilter).select('_id').lean();
      const productIds = rows.map((r) => r.productId);
      const agg = await InvQuant.aggregate([
        {
          $match: {
            tenantId: tid,
            productId: { $in: productIds },
            locationId: { $in: locs.map((l) => l._id) },
          },
        },
        { $group: { _id: '$productId', onHand: { $sum: '$quantityNum' } } },
      ]);
      const ledgerMap = new Map(agg.map((r) => [String(r._id), D(r.onHand?.toString?.() || '0')]));
      for (const c of rows) {
        const ledger = ledgerMap.get(String(c.productId)) || D(0);
        const cached = D(c.onHand || 0);
        if (!ledger.eq(cached)) {
          cacheMismatch += 1;
          if (cacheMismatch <= 25) {
            failures.push(fail(
              'CACHE_VS_LEDGER',
              `Cache ${decStr(cached)} ≠ ledger ${decStr(ledger)}`,
              `كاش المنتج لا يطابق الدفتر`,
              {
                productId: c.productId,
                warehouseId: c.warehouseId,
                cached: decStr(cached),
                ledger: decStr(ledger),
                suggestedRepair: 'POST /stock/report/reconcile/repair-cache',
              },
            ));
          }
        }
      }
    }
    checks.productStockCache = { ok: cacheMismatch === 0, sampled: caches.length, mismatch: cacheMismatch };
  }

  // ── 9) sequences sanity (no duplicate codes; next ≥ 1) ───────────
  {
    const seqs = await InvSequence.find({ tenantId: tid }).lean();
    const codes = seqs.map((s) => s.code);
    const dupCodes = codes.filter((c, i) => codes.indexOf(c) !== i);
    let badNext = 0;
    for (const s of seqs) {
      const n = Number(s.nextNumber ?? s.number ?? 1);
      if (!Number.isFinite(n) || n < 1) {
        badNext += 1;
        failures.push(fail(
          'SEQUENCE_INVALID',
          `Sequence ${s.code} has invalid next ${s.nextNumber}`,
          `تسلسل غير صالح`,
          { sequenceId: s._id, code: s.code },
        ));
      }
    }
    // Transfer name uniqueness is schema-enforced; surface duplicate-name count if any slipped
    const dupNames = await InvTransfer.aggregate([
      { $match: { tenantId: tid } },
      { $group: { _id: '$name', n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $limit: 10 },
    ]);
    for (const d of dupNames) {
      failures.push(fail(
        'DUPLICATE_TRANSFER_NAME',
        `Duplicate transfer name ${d._id} (${d.n})`,
        `اسم تحويل مكرر`,
        { name: d._id, count: d.n },
      ));
    }
    checks.sequences = {
      ok: dupCodes.length === 0 && badNext === 0 && dupNames.length === 0,
      duplicateCodes: dupCodes.length,
      badNext,
      duplicateTransferNames: dupNames.length,
    };
  }

  // Check 10) done checksum — sampled done moves/lines with a stamp
  {
    const moves = await InvMove.find({
      tenantId: tid,
      state: 'done',
      doneChecksum: { $exists: true, $ne: null },
    }).limit(Math.min(cap, 500)).lean();
    let moveMismatch = 0;
    let missingStamp = 0;
    for (const m of moves) {
      const expect = computeMoveDoneChecksum(m);
      if (m.doneChecksum !== expect) {
        moveMismatch += 1;
        if (moveMismatch <= 25) {
          failures.push(fail(
            'DONE_CHECKSUM_MISMATCH',
            `Done move ${m._id} checksum mismatch — record may have been edited after doneAt`,
            `تجزئة حركة مكتملة لا تطابق — ربما عُدّلت بعد الإكمال`,
            { moveId: m._id, doneAt: m.doneAt },
          ));
        }
      }
    }
    const unstamped = await InvMove.countDocuments({
      tenantId: tid,
      state: 'done',
      $or: [{ doneChecksum: null }, { doneChecksum: { $exists: false } }],
    });
    missingStamp = unstamped;
    // Unstamped legacy rows are informational until backfilled — not hard failures
    const lines = await InvMoveLine.find({
      tenantId: tid,
      state: 'done',
      doneChecksum: { $exists: true, $ne: null },
    }).limit(Math.min(cap, 500)).lean();
    let lineMismatch = 0;
    for (const l of lines) {
      const expect = computeMoveLineDoneChecksum(l);
      if (l.doneChecksum !== expect) {
        lineMismatch += 1;
        if (lineMismatch <= 25) {
          failures.push(fail(
            'DONE_LINE_CHECKSUM_MISMATCH',
            `Done move line ${l._id} checksum mismatch`,
            `تجزئة سطر حركة مكتمل لا تطابق`,
            { moveLineId: l._id, moveId: l.moveId, doneAt: l.doneAt },
          ));
        }
      }
    }
    checks.doneChecksum = {
      ok: moveMismatch === 0 && lineMismatch === 0,
      sampledMoves: moves.length,
      sampledLines: lines.length,
      moveMismatch,
      lineMismatch,
      legacyUnstampedMoves: missingStamp,
    };
  }

  const ok = failures.length === 0;
  return {
    ok,
    status: ok ? 'ok' : 'failed',
    failureCount: failures.length,
    failures,
    checks,
    durationMs: Date.now() - started,
    sampledCap: cap,
    generatedAt: new Date().toISOString(),
  };
}
