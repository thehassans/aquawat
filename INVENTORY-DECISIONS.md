# Inventory Module — Decision Log

## Approved stack mapping (2026-08-25)

| Spec term | Implementation |
|-----------|----------------|
| `companyId` | `tenantId` (existing multi-tenant key) |
| `createdById` | `createdBy` (ObjectId ref User) |
| Prisma | **Mongoose** (existing ODM) |
| Decimal | **decimal.js** + string storage in MongoDB |
| Next.js / server actions | **Express routes** + React Query on SPA |
| Direct stock writes | **Blocked** on legacy `/api/products/:id/stock*` once stock engine is active for tenant |

## Migration strategy

- **Parallel engine**: new `stock/*` models and services alongside legacy `Product.stocks[]`.
- Legacy GRN / stock-transfer / adjustment flows will get **adapter layers** (Phase 1+: receipts via Picking engine).
- Vertical catalogs (Bakala, Restaurant, Ecommerce, etc.) remain **out of scope** for all phases.

## Product catalog

- New **`ProductTemplate` + `ProductVariant`** models under `backend/models/stock/`.
- Legacy **`Product`** model unchanged — used by invoices, POS, purchases until explicit linking is built.
- Variants store optional `legacyProductId`; stock product form can link/unlink a legacy catalog product.

## Warehouse naming

- Legacy flat warehouse: `backend/models/Warehouse.js` (unchanged).
- Odoo-style warehouse: `StockWarehouse` model (`backend/models/stock/StockWarehouse.js`).
- Location tree: `StockLocation` model.

## Phase 1 scope delivered

- Location tree + 1-step warehouse bootstrap per tenant
- UoM category + reference UoM seed
- ProductTemplate / ProductVariant (**attributes engine**: cartesian regenerate; archive variants with moves)
- Quant ledger, StockMove, StockMoveLine, Picking
- Sequence table with transactional increment
- reserve / unreserve / confirm / validate / backorder
- Forecast + on-hand computation
- API under `/api/stock/*`
- UI: InventoryLayout (5 tabs), Overview, Receipts/Deliveries/Internal lists + forms, Stock report
- Unit tests for core invariants

## Phase 2 scope delivered

- **Lots / serials** (`StockLot`) with expiration/removal/use/alert dates
- Product template tracking (`none` | `lot` | `serial`) + expiration config
- FEFO removal strategy uses `lot.removalDate` (fallback expiration)
- Serial: reserve creates 1-unit lines; validate blocks duplicate incoming serials; quant qty ≤ 1
- **Packages** + package types + product packagings
- **Physical inventory** — set counted qty (persists), apply via moves to Inventory adjustment location
- **Scrap** — draft → validate creates scrapped move to scrap location
- **Traceability** — upstream/downstream tree per lot
- **Moves History** report
- Settings toggles for lots, packages, expiry
- Receipt op types default `useCreateLots`; lot name editable on move lines before validate

## Phase 3 scope delivered

- **Routes** + **Rules** (pull / push / pull_push / buy / manufacture)
- **runProcurement** with location-chain rule lookup, MTO chaining (`moveOrigIds`/`moveDestIds`), group propagation
- **Warehouse step reconfiguration** (`recomputeWarehouseRoutes`) — 1/2/3-step reception, ship/pick_ship/pick_pack_ship; in-flight pickings untouched
- **Orderpoints** + Replenishment view (permanent + virtual negative-forecast rows)
- Snooze (1d/1w/1m), Order Once, Save as permanent rule
- **Scheduler** (manual + cron via `STOCK_SCHEDULER_CRON=1`) with run log table
- **Putaway rules** + storage categories; applied on validate
- UI: Replenishment, Procurement Groups, Routes, Rules, Putaway, warehouse Steps editor
- `onBuyProcurement` / `onManufactureProcurement` create draft PO / Work Order when catalog bridges exist

## Phase 4 scope delivered

- **Valuation layers** (`StockValuationLayer`) — standard / AVCO / FIFO on validate when crossing internal boundary
- **Landed costs** (`StockLandedCost`) — compute split (qty/weight/volume/cost/equal) + validate posts adjustment layers; blocked for non–real-time FIFO/AVCO
- **Returns wizard** — swap src/dest from done pickings; UI on picking form
- **Barcode nomenclature** — rules + parse API + config UI
- **Reports** — Moves Analysis (pivot), Performance KPIs; Reporting hub subnav
- **Print** — `GET /pickings/:id/print` JSON + `?format=html` printable slip
- Settings: `useLandedCosts`, sign/reception/email flags
- Unit tests: FIFO remainingValue invariant, landed-cost split, barcode match, return location swap

## Phase 5 scope delivered (adapters + print)

- **GRN → Picking adapter** — when `engineEnabled`, receive/cancel posts via stock pickings; auto-bridges legacy `Product` → `StockProductVariant` (`legacyProductId`); Bakala lines still use legacy adjust
- **Purchase return** — same adapter path (outgoing / reverse)
- **Stock transfer → internal picking** — engine path validates internal move on ship and marks Completed; links `stockPickingId`
- **Warehouse bridge** — `StockWarehouse.legacyWarehouseId` + create-by-code when missing
- **Print HTML** — `GET /stock/pickings/:id/print?format=html` + UI opens printable slip
- **Concurrent reserve simulator** — 20×1 vs 10 units invariant in unit tests

## Phase 6 scope delivered (stock accounting)

- **Real-time journals** on valuation layers after picking validate (outside stock txn)
  - Receipt: Dr Inventory (1300) / Cr Stock Interim Received (1310)
  - Delivery: Dr Stock Interim Delivered (1320) / Cr Inventory (1300)
- **Landed cost journals** on validate: Dr Inventory / Cr Accrued Expenses (2200)
- Ensures COA codes 1310/1320; `JournalEntry.type = 'stock'`
- Settings: `stockAccountingEnabled` + optional account overrides
- Idempotent via `journalEntryId` + sourceModel/sourceId
- Unit tests for balanced line builders
- **Vendor bill clearing** — purchase invoices post Dr Stock Interim (1310) + VAT Input / Cr AP (2000) when linked to PO/GRN and stock accounting is on

## Phase 7–9 polish

- Product / location names on pickings + print HTML
- `onBuyProcurement` → draft Purchase Order (links legacy product when bridged)
- `onManufactureProcurement` → draft Manufacturing Work Order when BOM + legacy product exist
- Removed duplicate `tenantId` field-level indexes from stock `common.js`
- Quant updates use optimistic `version` check (`StockConflictError` + retry)
- Optional Mongo integration: `STOCK_TEST_MONGODB_URI=... npm run test:stock:integration`

## Phase 10–13 polish

- Legacy product link on stock product form (`legacyProductId`)
- Valuation layers panel on product form
- Storage Categories / Package Types / UoM / Product Categories configuration UI
- Product form: barcode, category, expiry use/alert times, picking description, UoM on create
- Settings: `engineEnabled` toggle (bootstraps on enable), lead times, annual inventory day, COA account overrides
- Barcode nomenclature “use as default” → `barcodeNomenclatureId`

## Phase 14 — Attributes & variants

- Models: `StockProductAttribute`, `StockProductAttributeValue`, `StockProductTemplateAttributeLine`
- Cartesian regenerate for `createVariant=always`; obsolete variants archived (never hard-deleted), warning when moves exist
- Config Attributes UI + product form Attributes & Variants panel
- Settings flag `groupProductVariant`

## Phase 15 — Reports + config locations/op types

- Locations report (quants by location + lot/package)
- Forecasted Inventory timeline with running balance + first-shortage flag
- Config: Locations tree editor, Operation Types reservation/backorder/lots
- Stock report product name links to forecast timeline

## Phase 16 — Overview charts, reordering rules, inter-WH resupply

- Overview cards: 7-day scheduled work bar chart
- Config Reordering Rules (permanent orderpoints)
- Warehouse `resupplyWarehouseIds` → pull routes supplier stock → supplied stock

## Phase 17 — Batches, variants list, packagings, print polish

- Transfer batches (`StockPickingBatch`) with confirm/check/validate/cancel bulk actions
- Product Variants list; packagings panel on product form
- Print slip: locations, scheduled date, signature lines, optional lots

## Deferred / polish

_(none — concurrent reserve covered by optimistic versioning + optional Mongo integration test)_

## Concurrency

- MongoDB multi-document transactions for all stock mutations.
- Quant documents use optimistic `version` field; retry once on write conflict / deadlock.

## UI primitives built for inventory

- `InventoryLayout.jsx` — 5-tab module nav (PurchasesLayout pattern)
- `inventoryUi.js` — shared tokens (fieldControlClass, STATUS_PILL, paths)
- Status pills map picking states to existing badge tokens
