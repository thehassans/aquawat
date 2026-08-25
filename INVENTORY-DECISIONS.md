# Inventory Module — Decision Log

Last updated: 2026-08-25

## Locked answers (Section 16 + discovery)

| # | Topic | Decision |
|---|---|---|
| 1 | MongoDB topology | **Replica set / transactions.** Use multi-document sessions for validate. Compose already runs `rs0`. |
| 2 | RTL | **Existing.** `uiSlice` + `translations.js` + Arabic fonts. Inventory screens must pass RTL; not a new workstream. |
| 3 | Inline On Hand edit | **Allowed as a ledger shortcut.** Stock report inline edit never writes a quant directly — it creates and validates an inventory-adjustment transfer. |
| 4 | UoM | **New `InvUom` / `InvUomCategory`.** Seed from distinct `Product.unitOfMeasure` strings. Leave `BakalaUnit` alone until Bakala migrates. |
| 5 | Catalog / migration scope | **Trading `Product` + `Warehouse` only** for Phase 1. Bakala and vertical inventories out of scope. |
| 6 | ZATCA | **Extend existing Invoice fields** (`uuid`, `icv`, `pih`, queue). No new transmission client until confirmed. |
| 7 | Per-warehouse restriction | **New at launch.** Hook on stock queries + User/tenant assignment; enforce when warehouseIds are set, otherwise permissive. |

## Schema conflict resolutions

| Topic | Decision | Reason |
|---|---|---|
| Sales document | Map **sell-flow `PurchaseOrder` + `DeliveryNote`** as the SO contract (Phase 3) | Best fit; no parallel SO until needed |
| GRN vs Transfer | **Keep GRN as façade** — confirm creates/validates an inventory Transfer underneath | Preserve existing purchase UX |
| Product category | **Promote** free-text `category` → `InvProductCategory` docs (Phase 1 seed + optional `categoryId` on Product) | Needed for valuation/routes later |
| Bilingual fields | Keep **`nameEn` / `nameAr`** | Maqder convention |
| Number storage | Engine fields = **string + `Decimal128` `*Num` mirror**. PO/Invoice stay `Number` until Phase 5 | Avoid big-bang money migration |
| Parallel product catalog | **Forbidden.** Extend legacy `Product`. Do **not** recreate `StockProductTemplate` | Brief absolute rule; prior revert lesson |

## Naming (Maqder, not reference ERP)

| Brief | Mongoose model | Collection |
|---|---|---|
| UomCategory | `InvUomCategory` | `invuomcategories` |
| Uom | `InvUom` | `invuoms` |
| Location | `InvLocation` | `invlocations` |
| OperationType | `InvOperationType` | `invoperationtypes` |
| Quant | `InvQuant` | `invquants` |
| Move | `InvMove` | `invmoves` |
| MoveLine | `InvMoveLine` | `invmovelines` |
| Transfer | `InvTransfer` | `invtransfers` |
| Sequence | `InvSequence` | `invsequences` |
| Settings | `InvSettings` | `invsettings` |
| Route | `InvRoute` | `invroutes` |
| Rule | `InvRule` | `invrules` |
| ReorderRule | `InvReorderRule` | `invreorderrules` |
| PutawayRule | `InvPutawayRule` | `invputawayrules` |
| StorageCategory | `InvStorageCategory` | `invstoragecategories` |
| ProcurementGroup | `InvProcurementGroup` | `invprocurementgroups` |
| SchedulerRun | `InvSchedulerRun` | `invschedulerruns` |
| ValuationLayer | `InvValuationLayer` | `invvaluationlayers` |
| LandedCost (engine) | `InvLandedCost` | `invlandedcosts` |

Warehouse / Product remain the existing collections, extended in place.
Legacy `LandedCost` (purchases) remains and bridges into engine layers on post.

## Architecture invariants

1. Nothing writes on-hand except Move validate → Quant delta.
2. Done moves / posted valuation are append-only; corrections reverse.
3. `quantity` string is canonical; `quantityNum` is aggregation-only.
4. Feature flag: `InvSettings.engineEnabled` (per tenant). Legacy `adjustProductStock` remains until cutover; migration writes opening Transfers.
5. API root: `/api/stock/*`.

## Deviations from brief

| Deviation | Reason |
|---|---|
| Model prefix `Inv*` | Avoid collision with legacy `StockTransfer` and any leftover `Stock*` collections from the reverted engine |
| Usage `inventoryLoss` stored as `inventoryLoss` | Matches brief (prior engine used `inventory`) |
| States use brief enums (`partiallyAvailable`, `cancelled`) | Maqder camelCase, not snake_case from prior attempt |
| Adjustment op type also uses `code: 'internal'` | Distinct via `sequenceCode` `WH/ADJ`; listed under Internal until a dedicated Adjustments menu (Phase 2) |

## Phase 2 delivered (2026-08-25)

- `InvLot` with expiry / removal / use-by / alert dates; Product tracking + expiration day fields
- FEFO reservation excludes expired lots; validate enforces lot/serial rules
- `InvPackageType`, `InvPackage`, `InvProductPackaging` (+ basic CRUD API)
- Physical inventory: set counted qty (persists), apply via adjustment moves, clear, request count
- Scrap draft → validate (internal → scrap location move)
- Return wizard on done transfers; Receipts ↔ Deliveries return op types wired at bootstrap
- Moves History + lot upstream/downstream traceability
- UI: Physical, Scrap, Lots (+ trace), Moves; Return on transfer form

## Phase 3 delivered (2026-08-25)

- `legacyAdapter`: `isInvEngineEnabled`, `postLinesViaEngine`, `reverseDocumentViaEngine`, `postPosSaleViaEngine`
- GRN confirm/cancel → incoming transfer (+ bakala still via adjust); `GRN.inventoryTransferId`
- Purchase return confirm/cancel → outgoing / reverse
- DeliveryNote create → outgoing transfer when engine on; `warehouseId` + `inventoryTransferId` on DN
- Vendor bill (`POST /invoices/purchase`) → **three-way match** before create; bumps `quantityInvoiced`
- Sell invoice skips stock when engine on (DN is ship moment); standalone purchase bill receives via engine
- `adjustProductStock` blocks trading writes when engine enabled (clear error)
- API: `POST /api/stock/pos-close` (idempotent), `POST /api/stock/three-way-match`
- Bakala PoS remains legacy (catalog out of Phase 1–3 scope)

## Phase 3 deferred

- Bakala adjustments UI still posts without `warehouseId` (catalog out of engine scope; fails clearly when engine on)
- ~~Wire trading desktop PoS UI to `/stock/pos-close`~~ **superseded**: trading sell is `InvoiceSellComposer` → `POST /invoices/sell` → `postLinesViaEngine`. Calling `/stock/pos-close` on top would double-deduct. Keep `pos-close` for a future offline counter that skips invoice stock posting.
- ~~Draft receipt on PO approve~~ **delivered**: approve creates idempotent draft GRN (no stock until GRN receive); purchases GRN routes restored

## Phase 4 delivered (2026-08-25)

- Models: `InvRoute`, `InvRule`, `InvReorderRule`, `InvPutawayRule`, `InvStorageCategory`, `InvProcurementGroup`, `InvSchedulerRun`
- `runProcurement`: rule resolution (product → category → warehouse → global), pull/push/buy/manufacture, MTO chaining (depth ≤ 8), buy → draft PO, manufacture stub never crashes
- Multi-step reception/delivery via `recomputeWarehouseRoutes` + warehouse form; inter-warehouse resupply routes from `resupplyFromWarehouseIds`
- Replenishment list (permanent + virtual), order once, snooze; scheduler with per-tenant re-entrancy lock + reservation retry
- Putaway on validate; storage category capacity checks
- UI: Replenish, Routes, Putaway, Scheduler; warehouse steps panel
- Cron: `STOCK_SCHEDULER_CRON=1` + `InvSettings.schedulerEnabled`
- `Product.routeIds` for preferred routes

## Phase 5 delivered (2026-08-25)

- `InvValuationLayer` + `InvLandedCost` (engine); layers on transfer validate when crossing internal boundary
- Costing from `InvProductCategory.costingMethod` (`standard` / `average` / `fifo`); AVCO updates `Product.costPrice`
- `stockAccountingEnabled` + interim accounts `1310`/`1320`; journals type `stock` (idempotent on layer)
- Category `valuationMode: manual` writes layers but skips journals
- Engine landed cost: create → compute → validate (FIFO remainingValue / AVCO bump + journal)
- Legacy `LandedCost` post bridges into engine layers when engine enabled
- Move `unitCost` from GRN `costPrice` via `legacyAdapter`
- UI: Valuation report + engine Landed Costs; APIs under `/api/stock/valuation-*`, `/landed-costs`

## Phase 6 delivered (2026-08-25)

- Reporting: Moves Analysis, Performance KPIs, Forecast report + Reporting hub UI
- CSV export: products, stock (+ value), locations, lots, reorder-rules
- Product CSV import with `externalId` upsert, dry-run, **countedQty → physical count only** (never direct quant)
- Inventory Settings page (feature flags, lead times, annual count, ensure stock accounts)
- Barcode nomenclature model + test box
- ZATCA model polish: `zatca.invoiceType` (standard/simplified); `ensureInvoiceZatcaStub` stamps uuid/icv/pih on sell + purchase create; `invoice.inventory.transferIds` / `journalEntryId`
- Purchase bill interim clearing journal via `postPurchaseInvoiceJournal` when stock accounting on

## Post–Phase 6 hardening (2026-08-25)

- Sell invoice with warehouse posts via engine when no DeliveryNote (PoS / direct invoice); DN still skips double-deduct
- Legacy `/api/stock-transfers` → InvTransfer when engine on (`inventoryTransferId` façade)
- Legacy `/api/inventory-adjustments` → ADJ transfers (gain/loss vs `inventoryLoss`) when engine on; requires `warehouseId`; stores `inventoryTransferIds`
- `Product.stocks[]` / `totalStock` mirrored from quants after validate (`syncProductStockCache`); overview “Sync product cache”
- User `warehouseIds` editable in Users → Access; API create/update persists; enforced when `enforceWarehouseRestriction` on list + create/mutate transfer + stock adjust
- Overview quick links: Stock / Reports / Replenish / Settings
- Trading sell: `warehouseId` **required** when engine on (non-draft / non-proforma); stock-post failures return 409 (no silent skip)
- `GET /api/stock/engine-status` — lightweight `engineEnabled` for sell UI (no `inventory:read` needed)
- `/stock/pos-close` remains API-only for future offline PoS (not wired to sell composer)
- PO approve → idempotent draft GRN (`ensureDraftGrnForApprovedPo`); stock still only on GRN receive; purchases GRN list/form routes restored
- Vendor bill: live **three-way match** preview (`POST /invoices/three-way-match`) + clearer 409 errors; approved PO cancel allowed if no stock received (cancels draft GRNs)
- Fixed `reserve.js` missing `mongoose` / `InventoryValidationError` imports (validate path)
- `POST /products/:id/stock(/set)` blocked when engine on; ProductForm adjusts via Stock Report API
- Delivery Note: warehouse required when engine on (FE+BE); stock errors surfaced
- Sell invoice auto-selects primary/first warehouse when engine on; GRN receive requires warehouse

## Open (defer)

- When to remove `Product.stocks[]` cache after full cutover (now a read mirror)
- Bakala / furniture / bookstore catalog merge into Inv* ledger
- Full Odoo-parity import wizard (XLSX, field trees, saved templates) — Phase 6 ships CSV core only
- ZATCA transmission client (explicitly out of scope until confirmed)
