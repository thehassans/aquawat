import { createHash } from 'crypto';
import { decStr } from '../../utils/decimal.js';

/**
 * Stable content hash for done ledger rows (§3.6 check 10).
 * Recomputed on integrity runs — mismatch means a done record was mutated.
 */
export function computeMoveDoneChecksum(move) {
  const parts = [
    'move',
    String(move.productId || ''),
    String(move.variantId || ''),
    decStr(move.demandQty ?? '0'),
    decStr(move.doneQty ?? '0'),
    String(move.sourceLocationId || ''),
    String(move.destLocationId || ''),
    String(move.uomId || ''),
    String(move.transferId || ''),
    'done',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export function computeMoveLineDoneChecksum(line) {
  const parts = [
    'line',
    String(line.moveId || ''),
    String(line.productId || ''),
    String(line.variantId || ''),
    decStr(line.quantity ?? '0'),
    decStr(line.quantityInProductUom ?? line.quantity ?? '0'),
    String(line.sourceLocationId || ''),
    String(line.destLocationId || ''),
    String(line.lotId || ''),
    String(line.packageId || ''),
    'done',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

/** Stamp doneAt + checksum when transitioning a move into done (same save). */
export function stampMoveDone(move, { at = new Date() } = {}) {
  move.state = 'done';
  move.doneAt = at;
  move.doneChecksum = computeMoveDoneChecksum(move);
  return move;
}

export function stampMoveLineDone(line, { at = new Date() } = {}) {
  line.state = 'done';
  line.doneAt = at;
  line.doneChecksum = computeMoveLineDoneChecksum(line);
  return line;
}
