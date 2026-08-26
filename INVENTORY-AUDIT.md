# Inventory Module — Audit Report

**Date:** 2026-08-26  
**Code HEAD:** `4cab7b52` (`origin` → `https://github.com/thehassans/aquawat.git`)  
**Auditor method:** Static route/menu/engine/schema/UI scan + recent production console evidence from `trading-maqder.maqder.com`.  
**Live seed tenant (§1.2):** **Not available in this session** — no clean dual-tenant seed with MAIN/WH2, 12 products, role matrix. Therefore **no item may be marked PASS under §1.1 evidence rules** for end-to-end UI/API behaviour.

> **Rule applied:** Where only code was inspected, status is `CODE_PRESENT` / `CODE_GAP` / `NOT_EXECUTED` — never `PASS`. Production incidents from the operator session are recorded as `PARTIAL` / `FAIL` with evidence.

---

## 1. Executive summary

| Area | PASS | PARTIAL | FAIL | NOT_EXECUTED / CODE_* |
|------|------|---------|------|------------------------|
| §2 Screens (37) | 0 | 10 path-contract | 0 missing | 27 EXISTS (prefix OK); 12 orphans |
| §3 List checks × lists | 0 | — | — | Universal matrix **NOT_EXECUTED**; static sample shows systemic L7–L9 gaps |
| §4 Form checks × forms | 0 | — | — | **NOT_EXECUTED**; static: F2/F5/F16 largely CODE_GAP |
| §5 Screen completion | 0 | many | — | Completion backlog §11 of this report |
| §6 Workflows W1–W24 | 0 | 0 | 0 | **24 NOT_EXECUTED** (no seed tenant) |
| §7 Engine E1–E15 | 0 | several CODE_GAP | — | Mostly CODE_PRESENT; concurrent E4/E6 UNKNOWN |
| §8 Schema | 0 | gaps | — | `pickSequence` missing; Product money as Number |
| §9 Cross-cutting | 0 | — | — | **NOT_EXECUTED** (isolation / perf / RTL live) |

### Top 10 defects by severity (static + production evidence)

| Rank | Sev | ID | Defect |
|------|-----|-----|--------|
| 1 | S2 | D01 | Inventory API errors return nested `{code,message,messageAr}` objects; many toasts still passed the object → React #31 crash (scrap validate on over-qty). *Mitigation shipped `0fdf61b5` / `4cab7b52` — **re-verify on deployed trading-maqder**.* |
| 2 | S2 | D02 | Insufficient-stock message omits **product**, **location**, and **shortfall** (only “available” qty). Spec E14. |
| 3 | S2 | D03 | Product categories list / Journal populate fragility → 400 on `/api/stock/product-categories` (prod evidence). *Hardening shipped — re-verify.* |
| 4 | S2 | D04 | Returns identified by `origin: "Return of …"` string — no `isReturn` / `returnOfPickingId` (spec §5.2). |
| 5 | S2 | D05 | Procurement PO/WO numbering uses `lastSeq + 1` (not InvSequence `$inc`) — race under concurrency (§7 E12 adjacent). |
| 6 | S3 | D06 | Product `costPrice` / `sellingPrice` stored as Mongo `Number` (float) while engine uses Decimal strings. |
| 7 | S3 | D07 | Transfer list lacks server pagination / group-by / column prefs / multi-select / bulk (L3, L7–L11). |
| 8 | S3 | D08 | Forms lack record pager (F2), dirty navigation guard (F5 most forms), optimistic concurrency UI (F16). |
| 9 | S3 | D09 | Priority / deadlineDate on InvTransfer exist in schema but are not editable in TransferForm UI. |
| 10 | S3 | D10 | §2 path contract drift (`pos` vs `pos-orders`, reports not under `/reports/…`, etc.) — bookmarks/docs break. |

**Exit criteria (§11):** **Not met.** Do not start v4 Part B.

---

## 2. Screen inventory (§2)

App prefix: `/app/dashboard/inventory` (not bare `/inventory`). Menus: `frontend/.../inventory.menu.js` ↔ `backend/services/inventory/menu.js`.

| # | Screen | Expected (spec) | Actual route | Menu | Status |
|---|--------|-----------------|--------------|------|--------|
| 1 | Overview | `/inventory` | `/app/dashboard/inventory` | Yes | EXISTS |
| 2 | Receipts | `…/receipts` | `…/receipts` | Yes | EXISTS |
| 3 | Deliveries | `…/deliveries` | `…/deliveries` | Yes | EXISTS |
| 4 | Internal | `…/internal` | `…/internal` | Yes | EXISTS |
| 5 | PoS Orders | `…/pos-orders` | `…/pos` | Yes | BROKEN (path slug) |
| 6 | Manufacturing | `…/manufacturing` | `…/manufacturing` | Yes | EXISTS |
| 7 | Returns | `…/returns` | `…/returns` | Yes | EXISTS |
| 8 | Physical | `…/physical` | `…/physical` | Yes | EXISTS |
| 9 | Scrap | `…/scrap` | `…/scrap` | Yes | EXISTS |
| 10 | Replenishment | `…/replenishment` | `…/replenishment` | Yes | EXISTS |
| 11 | References | `…/references` | `…/references` | Yes | EXISTS |
| 12 | Run Scheduler | action | menu action → `POST /stock/scheduler/run` | Yes | EXISTS (action) |
| 13 | Products | `…/products` | `…/products` | Yes | EXISTS |
| 14 | Variants | `…/variants` | `…/variants` | Yes | EXISTS |
| 15 | Lots | `…/lots` | `…/lots` | Yes | EXISTS |
| 16 | Packages | `…/packages` | `…/packages` | Yes | EXISTS |
| 17 | Stock report | `…/reports/stock` | `…/stock` | Yes | BROKEN (path) |
| 18 | Locations report | `…/reports/locations` | `…/report/locations` | Yes | BROKEN (path) |
| 19 | Moves History | `…/reports/moves` | `…/moves` | Yes | BROKEN (path) |
| 20 | Moves Analysis | `…/reports/analysis` | `…/moves-analysis` | Yes | BROKEN (path) |
| 21 | Performance | `…/reports/performance` | `…/performance` | Yes | BROKEN (path) |
| 22 | Valuation | `…/reports/valuation` | `…/valuation` | Yes | BROKEN (path) |
| 23 | Settings | `…/settings` | `…/settings` | Yes | EXISTS |
| 24 | Warehouses | `…/warehouses` | `…/warehouses` | Yes | EXISTS |
| 25 | Operation Types | `…/operation-types` | `…/operation-types` | Yes | EXISTS |
| 26 | Locations | `…/locations` | `…/locations` | Yes | EXISTS |
| 27 | Rules | `…/rules` | `…/rules` | Yes | EXISTS |
| 28 | Routes | `…/routes` | `…/routes` | Yes | EXISTS |
| 29 | Putaway | `…/putaway` | `…/putaway` | Yes | EXISTS |
| 30 | Storage Categories | `…/storage-categories` | `…/storage-categories` | Yes | EXISTS |
| 31 | Reordering | `…/reordering` | `…/reordering-rules` | Yes | BROKEN (path) |
| 32 | Product Categories | `…/categories` | `…/product-categories` | Yes | BROKEN (path) |
| 33 | Attributes | `…/attributes` | `…/attributes` | Yes | EXISTS |
| 34 | UoM | `…/uom` | `…/uom` | Yes | EXISTS |
| 35 | Barcode Nomenclature | `…/barcode-nomenclature` | `…/barcode` | Yes | BROKEN (path) |
| 36 | Landed Costs | `…/landed-costs` | `…/landed-costs` | Yes | EXISTS |
| 37 | Import / Export | `…/import-export` | `…/import-export` | Yes | EXISTS |

**Counts:** EXISTS 27 · BROKEN (path) 10 · MISSING 0.

### Orphans (exist outside the 37)

Batches, Exceptions, Jobs, Forecast, Reception report, Reconcile, Reports hub, Product packagings, Quality points, Delivery methods, Shipping connectors, Scheduler page (URL-only; menu uses action).

**Decision needed:** keep as extras, fold into the 37, or delete unused.

---

## 3. List checks (§3) — matrix status

**Live matrix 20 × every list: NOT_EXECUTED** (requires seeded tenant + Admin/Operator passes).

### Static sample (CODE_PRESENT / CODE_GAP) — representative lists

| Check | Transfers | Scrap | Products | Physical | Categories |
|-------|-----------|-------|----------|----------|------------|
| L3 Pagination | GAP (`limit:80`) | GAP | PRESENT | PRESENT | PRESENT (client) |
| L6 URL filters | PARTIAL (`?state=`) | GAP | PARTIAL | GAP | GAP |
| L7 Group by | GAP | GAP | GAP | GAP | GAP |
| L8 Saved filters | GAP | GAP | GAP | GAP | GAP |
| L9 Column optioning | GAP | GAP | GAP | GAP | GAP |
| L10 Multi-select | GAP | GAP | GAP | PARTIAL | PARTIAL |
| L11 Bulk actions | GAP | PRESENT (validate drafts) | GAP | PRESENT (apply) | PRESENT |
| L15 Export picker | GAP | GAP | PRESENT (IE) | PRESENT | PRESENT |
| L16 Import dry-run | GAP | GAP | PRESENT | PRESENT | PRESENT |
| L17 Row `href` | PRESENT (`Link`) | PRESENT | PRESENT | n/a | PRESENT |
| L2 Isolation / L18 perf / L20 perms | NOT_EXECUTED | | | | |

**Systemic finding:** L7–L9 are absent almost everywhere → treat as one platform gap, not 20 separate bugs.

---

## 4. Form checks (§4) — matrix status

**Live matrix: NOT_EXECUTED.**

### Static sample

| Check | TransferForm | ScrapForm | ProductForm | Settings | CategoryForm |
|-------|--------------|-----------|-------------|----------|--------------|
| F2 Record pager | GAP | GAP | GAP | n/a | GAP |
| F5 Dirty guard | GAP | GAP | GAP | PRESENT | GAP |
| F9 Smart buttons | PARTIAL | GAP | PRESENT | GAP | GAP |
| F11 Chatter | PRESENT (light) | GAP | GAP | GAP | GAP |
| F12 Attachments | GAP | GAP | PARTIAL (images) | GAP | GAP |
| F13 Duplicate | GAP | GAP | GAP | n/a | PRESENT |
| F16 Concurrency | GAP | GAP | GAP | GAP | GAP |
| F17 Read-only when done | PARTIAL (needs runtime) | PARTIAL | n/a | n/a | n/a |

---

## 5. Screen-by-screen findings (§5)

| Screen | Verify (runtime) | Completion items already in code | Still open (completion) |
|--------|------------------|----------------------------------|-------------------------|
| Overview | NOT_EXECUTED | Health strip API exists | Late highlight, kebab, WH selector persist, empty onboarding |
| Transfers ×6 | NOT_EXECUTED | Shared TransferForm; Detailed Ops tab present; backorder fields | Priority/deadline editors; Duplicate done picking; Cancel+reason; Add-all-remaining; real Returns flag |
| Physical | NOT_EXECUTED | Apply + IE + filters chips (static) | Request a Count; reason codes required; totals bar; lastCountDate on Locations UI |
| Scrap | PARTIAL (prod: over-qty crashed toast; fix shipped) | Multi-line create, validate | Reason code required; photo; link to source picking |
| Replenish / Scheduler | NOT_EXECUTED | Scheduler run history page exists | Lead-time cols; Why? popover; bulk Order Once |
| Products | PARTIAL (prod: categories 400, accounting stock fields) | Accounting income/expense-only after fix; General sale/cost/UoM added | On-hand drill-down; forecast timeline; multi-barcode |
| Reports | NOT_EXECUTED | Shared ReportShell + groupBy URL | Inventory at Date; stock↔valuation equality check live |
| Settings | NOT_EXECUTED | Accounting modes; Ensure accounts; dirty guard | Per-toggle behavioural proof table; delete dead toggles |
| Warehouses / OT / Loc / Rules | NOT_EXECUTED | Bootstrap warehouse locations/OT | `pickSequence`; archive guards; route diagram |
| Categories / UoM / Barcode | NOT_EXECUTED | Costing preview API; category duplicate | KSA UoM seed; unified Units&Packagings landing |

---

## 6. Workflow results (§6)

| # | Flow | Result | Document ids |
|---|------|--------|--------------|
| W1–W24 | All end-to-end flows | **NOT_EXECUTED** | — |

**Blocker:** §1.2 seed tenant (2 WH, 12 products, 2 tenants, Admin + Operator) not provisioned in this environment.

**Production anecdotes (not full W-pass):**
- Scrap validate with qty > on-hand → 400 + React #31 (before fix).
- Product accounting / categories UX issues observed on trading-maqder (before/partially after `0fdf61b5`).

---

## 7. Engine results (§7)

| # | Check | Static verdict | Evidence |
|---|-------|----------------|----------|
| E1 | Move state machine | CODE_PRESENT (partial) | `MOVE_STATES`; no central `canTransition` |
| E2 | Picking state from moves | CODE_PRESENT | `deriveTransferState` / `recomputeTransferState` |
| E3 | Removal strategy order | CODE_PRESENT | `sortQuantsForRemoval` |
| E4 | reserve txn + lock | CODE_PRESENT + UNKNOWN_RUNTIME | `atomicReserveQuant`; concurrent test file exists — not run here |
| E5 | unreserve | CODE_PRESENT | `unreserveMove` |
| E6 | validate idempotent | CODE_PRESENT + UNKNOWN_RUNTIME | early done return + `validateLock` |
| E7 | Quant merge/GC | CODE_PRESENT | unique dim key; delete when zero |
| E8 | Serial qty ≤ 1 | CODE_PRESENT | `SERIAL_QTY_EXCEEDED` |
| E9 | Valuation on boundary | CODE_PRESENT | `srcInternal !== destInternal` |
| E10 | FIFO oldest-first | CODE_PRESENT | layers + quant `inDate` |
| E11 | AVCO formula | CODE_PRESENT | `computeAverageCost` (+ unit tests) |
| E12 | Sequences | CODE_PRESENT (InvSequence); GAP on PO/WO | `$inc` in `sequence.js`; `lastSeq+1` in `procurement.js` |
| E13 | Done immutable | CODE_PRESENT moves; layers allow remaining* updates | `appendOnly` / `noDelete` |
| E14 | Negative stock message | CODE_GAP | available qty only — no product/location/shortfall |
| E15 | Transactions | CODE_PRESENT | `runWithTransaction` on mutate paths |

**Unit tests observed passing locally (not a substitute for E PASS):** `accountingMode`, `inventoryValuation`, `invErrorFormat`, product accounting / sales journal suites.

---

## 8. Schema gaps (§8)

| Spec field | Status | Notes |
|------------|--------|-------|
| `dateDeadline` | RENAMED | `deadlineDate` on transfer/move |
| `priority` | PRESENT | enum; UI not editable |
| `backorderId` | RENAMED | `backorderOfId` |
| `originRef` | GAP | only `origin` string |
| `propagateCancel` | PRESENT | |
| `procureMethod` | PRESENT | |
| `picked` | RENAMED | `isPicked` |
| `inDate` | PRESENT | on quant |
| `lastCountDate` | PRESENT | quant + location |
| `pickSequence` | **MISSING** | no matches in repo |
| `returnPickingTypeId` | RENAMED | `returnOperationTypeId` |
| `productId` | PRESENT | Product human code + move ObjectIds |
| `alertDate` | PRESENT | InvLot |
| `isReturn` / `returnOfPickingId` | **MISSING** | returns via origin text |
| Qty/cost on Inv* | Decimal string + Decimal128 | |
| Product money | **Number (float)** | costPrice, sellingPrice |
| Unique indexes | CODE_PRESENT | transfer name, quant dims, location path, lot, sku, productId |

Explain-plan verification of indexes: **NOT_EXECUTED**.

---

## 9. Cross-cutting (§9)

| Area | Result |
|------|--------|
| Tenant isolation (foreign tenant → 403) | NOT_EXECUTED |
| Permissions matrix Admin vs Operator | NOT_EXECUTED |
| Typed bilingual errors | PARTIAL — catalog exists; many FE toasts historically unwrapped wrong (fixed helper `formatInvError`) |
| i18n / RTL live | NOT_EXECUTED |
| Performance 50k / p95 | NOT_EXECUTED |
| N+1 ≤ 10 | PARTIAL tooling (`stockQueryBudget`) — not measured live |
| Audit log on config | CODE_PRESENT (`InvConfigAudit` / settings) — not fully proven on all forms |
| a11y / 390px | NOT_EXECUTED |
| WebSocket `socket.io` handshake 200 | FAIL observed on trading-maqder console (outside inventory core; infra) |

---

## 10. Defect register

| ID | Sev | Symptom | Root cause | Proposed fix | Est. |
|----|-----|---------|------------|--------------|------|
| D01 | S2 | Scrap validate crashes UI | Nested `error` object → toast as React child | `formatInvError` + audit remaining toasts *(shipped — retest)* | S |
| D02 | S2 | Stock short message weak | `quantDelta` omits product/location/shortfall | Enrich `INSUFFICIENT_STOCK` details + message | S |
| D03 | S2 | Categories 400 | Journal populate / schema registration | Import Journal + lean fallback *(shipped — retest)* | S |
| D04 | S2 | Returns fragile | String origin convention | Add `isReturn` + `returnOfTransferId`; migrate | M |
| D05 | S2 | PO/WO seq races | `lastSeq+1` | Route through `InvSequence` `$inc` | M |
| D06 | S3 | Float money on Product | Schema `Number` | Decimal string + migration | L |
| D07 | S3 | Thin transfer lists | No list platform | Shared list shell: page/sort/URL/group/cols/bulk | L |
| D08 | S3 | Form UX gaps | No pager/dirty/version | Shared form chrome | L |
| D09 | S3 | Priority/deadline unused | UI never binds fields | Editors on TransferForm | S |
| D10 | S4 | Path ≠ spec | Historical routes | Aliases or redirect map | S |
| D11 | S3 | No `pickSequence` | Never modelled | Field + sort move lines | S |
| D12 | S3 | E1 no transition guard | Ad-hoc state sets | Central `assertMoveTransition` | M |
| D13 | S4 | Orphan screens | Feature creep | Keep/delete decision | S |
| D14 | S2 | Socket.io 200 handshake | Proxy/infra | Ops: WS upgrade path | M (ops) |

---

## 11. Completion backlog (§5 “Complete” items)

Prioritised after S1/S2 defects. Effort: S &lt; 1d · M 1–3d · L &gt; 3d.

| Pri | Item | Est. | Notes |
|-----|------|------|-------|
| P0 | Re-run §1.2 seed + Admin/Operator full audit | M | Unblocks all NOT_EXECUTED → real PASS/FAIL |
| P0 | D02 insufficient-stock message enrichment | S | |
| P0 | D04 Returns proper flags | M | |
| P0 | D05 Sequence races in procurement | M | |
| P1 | Transfer list platform (L3/L6–L11) | L | Shared with other lists |
| P1 | TransferForm: priority, deadline, duplicate, cancel+reason, add-all-remaining | M | |
| P1 | Physical: Request Count, reason codes, totals | M | |
| P1 | Scrap: reason + attachment + source link | M | |
| P1 | Product: on-hand drill-down, multi-barcode | M | |
| P2 | `pickSequence` + location smart buttons | M | |
| P2 | Route diagram | S | |
| P2 | Inventory at Date | M | |
| P2 | Path aliases (§2) | S | |
| P2 | Orphan screen decision | S | |
| P3 | Product money Decimal migration | L | |
| P3 | Scheduled report email | L | |
| P3 | Central move transition matrix | M | |

---

## 12. Proposed fix plan (by root cause — no repairs in this phase)

Per user instruction §12.1: **report first; do not begin repairs while auditing.**

1. **Provision audit harness** — scripted seed tenant (§1.2) + CI smoke for W1–W4 minimum.  
2. **Error UX platform** — finish `formatInvError` adoption; enrich E14 messages (D01/D02).  
3. **Identity & returns** — InvSequence for PO/WO; `isReturn` fields (D04/D05).  
4. **List/form shell** — one shared list + form chrome closing L7–L9 / F2/F5/F16 (D07/D08).  
5. **Schema completeness** — `pickSequence`, Decimal product money (D06/D11).  
6. **Path/orphan cleanup** — redirects + menu decisions (D10/D13).  
7. **Re-audit** — fill §3/§4/§6/§7 runtime columns; open `INVENTORY-DECISIONS.md` updates for every deviation.

---

## 13. Exit criteria checklist (§11)

- [ ] All 37 screens exist, render, reachable; orphans decided  
- [ ] §3 pass on every list — **blocked**  
- [ ] §4 pass on every form — **blocked**  
- [ ] W1–W24 PASS with ids — **blocked**  
- [ ] E1–E15 PASS — **blocked** (static only)  
- [ ] Schema gaps closed + explain plans — **open**  
- [ ] Zero S1/S2 open — **open** (D02–D05 still; D01/D03 need deploy retest)  
- [ ] Settings toggles proven or deleted — **blocked**  
- [ ] Integrity zero drift after 500-op script — **blocked**  
- [ ] Arabic RTL full module — **blocked**  
- [ ] Perf targets recorded — **blocked**  
- [x] Completion backlog written and sized — **this §11**

**v4 Part B: do not start.**

---

## 14. Ask / stop conditions

1. **Seed tenant:** Can we provision §1.2 (or point at a staging DB) so W1–W24 and L/F matrices can be executed?  
2. **Orphans:** Keep batch/quality/shipping extras or delete?  
3. **Path contract:** Prefer redirects to spec URLs, or update the verification doc to Maqder’s actual paths?  
4. **Deploy:** Confirm `4cab7b52` is live on `trading-maqder` before treating D01/D03 as closed.
