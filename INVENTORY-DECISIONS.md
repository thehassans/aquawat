# Inventory Module — Decision Log

Last updated: 2026-08-26

## Hardening — costing / operations / scrap (2026-08-26)

| Topic | Decision |
|---|---|
| AVCO | `computeAverageCost` — on-hand × old avg + receipt × unit cost; PO/GRN `unitCost` on moves |
| Inventory evaluation | `InvSettings.inventoryEvaluationEnabled` gates valuation layers (journals still `stockAccountingEnabled`) |
| Negative stock | Global `allowNegativeStock` OR category/product; reserved underflow clamped on immediate validate |
| Partners | Outgoing → Customer; incoming → Supplier (`partnerResolve.js`); print-context includes partner |
| Ops UX | Editable Done + demand/done confirm + `moveQuantities`; variants select; deliveries list customer column |
| Scrap | Multi-line create, UoM/source/scrap loc/date, validate + cache sync, bulk validate |
| Physical export | UoM + product name + nested warehouse + list filters |

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

## v2 IA (2026-08-25) — Step 1

| Topic | Decision |
|---|---|
| Models / ledger | Keep **`Inv*`** (`InvTransfer` = Picking). UI labels follow v2 terminology. |
| API | Keep **`/api/stock/*`**. Add **`/api/inventory/menu`** (presentation). |
| Menu file | `frontend/src/pages/inventory/inventory.menu.js` + backend `services/inventory/menu.js` |
| Manufacturing / PoS | Menu entries gated by flags; Manufacturing → standalone `/app/dashboard/manufacturing`; PoS → `/inventory/deliveries?isPos=1` |
| Missing screens | Placeholder pages under InventoryLayout until Steps 2–4 |
| Flat top tabs | Replaced by Overview + Operations / Products / Reporting / Configuration dropdowns |

### Menu migration (current → v2)

| Old | New |
|---|---|
| Overview | Overview |
| Products | Products ▾ |
| Warehouses | Configuration ▾ → Warehouses |
| Receipts / Deliveries / Internal | Operations ▾ |
| Physical / Scrap | Operations ▾ → Adjustments |
| Lots | Products ▾ |
| Moves / Stock / Valuation / Reports | Reporting ▾ |
| Replenish | Operations ▾ → Procurement |
| Routes / Putaway / Settings | Configuration ▾ |
| Bootstrap / Migrate / Sync | Configuration → Settings → Maintenance (admin) |

## v2 IA — Step 2 (Configuration forms)

| Topic | Decision |
|---|---|
| Warehouse create | `POST /api/warehouses` auto-runs `ensureInventoryBootstrap` → `bootstrapWarehouse` → `recomputeWarehouseRoutes` |
| Location / category paths | `completePath` rebuilt on rename/reparent; descendants cascaded; cycle guards |
| Operation types | Sequence code/prefix immutable after create; archive blocked if open transfers |
| Location archive | Blocked if any quant has non-zero qty/reserve |
| Write APIs | `POST/PATCH /stock/locations`, `/operation-types`, `/product-categories`, `/uoms`; `PATCH` storage-categories & reorder-rules |
| UI | `ConfigPages.jsx` replaces Step 2 placeholders; Routes/Rules stay on `AutomationPages` |
| Ledger | Unchanged — no InvMove / transfer semantics touched |

## v2 IA — Step 3 (Settings → real behaviour)

| Topic | Decision |
|---|---|
| Model | Keep **`InvSettings`** (not rename to StockSettings); one row per tenant |
| Flag aliases | v2 names mirrored onto existing columns (`receptionReportEnabled` ↔ `groupReceptionReport`, etc.) |
| Multi-locations off | Blocked if stock exists in >1 internal location per warehouse |
| Multi-step routes on | Force-enables `groupStockMultiLocations` |
| Picking policy `one` | `checkAvailability` unreserves + `waiting`; validate blocked until all moves `assigned` |
| Packages / lots off | Move lines with package/lot rejected server-side |
| Signature | Required on outgoing validate when flag on |
| SMS confirmation | Cannot enable without tenant SMS provider credentials |
| Shipping connectors | Flags only + `InvDeliveryCarrier` / `CarrierProvider` stubs — **no live carrier APIs** |
| Quality / Batch | Minimal `InvQualityPoint`/`InvQualityCheck` / `InvBatchTransfer` models; quality blocks validate while `none` |
| Partner warnings | `Customer.stockWarn` / `stockWarnMsg`; block on create/confirm when `block` |
| UI | `InventorySettingsPage.jsx` — sectioned, sticky Save, dirty `beforeunload` |

## v2 IA — Step 4 (Product + picking form parity)

| Topic | Decision |
|---|---|
| Smart buttons | `GET /stock/products/:id/smart-buttons` aggregate; product form deep-links |
| Sale/PoS/Purchase | Mapped to existing `canBeSold` / `canBeSoldOnPos` / `canBePurchased` |
| Track Inventory off | Blocked while legacy or engine stock exists |
| Picking form | Partner, op-type-driven locations, barcode scan [flag], detailed ops tab, signature capture, lightweight chatter (log notes on transfer.note) |
| Variants / Attributes | Shipped — `InvProductAttribute` / values / `InvProductVariant`; see later section |


| Full Odoo chatter | Not ported; inventory uses transfer note trail only |

## v2 IA — Step 5 (Report family + reconciliation)

| Topic | Decision |
|---|---|
| Report shell | Shared `ReportShell` + URL filters (`warehouseId`, dates, …) across Stock / Locations / Moves / Analysis / Performance / Forecast / Valuation / Reconcile |
| Locations report | `GET /stock/report/locations` — quants rolled up by `completePath`; menu flag `multiLocations` |
| Hard invariant | Per product: stock report value == valuation value; totals exposed as `stockValueTotal` / `valuationValueTotal` / `valueDrift` |
| Reconcile API | `GET /stock/report/reconcile` (+ optional `includeCache`); issues: `QTY_LEDGER_VS_VALUATION`, `FIFO_VALUE_VS_LAYERS`, `STOCK_VALUE_VS_VALUATION`, `CACHE_VS_LEDGER` |
| Cache repair | `POST /stock/report/reconcile/repair-cache` re-runs `syncProductStockCache` then re-reconciles |
| Stock report | Rows include `value`; response includes `valueTotal` (same valuation helper) |
| Menu | Reporting adds **Reconcile**; Locations stays under Reporting (config **Locations** unchanged) |
| Ledger | Not redesigned — reconcile reads quants / layers / product cache only |

## v2 IA — Step 6 (Section 15 enhancements)

| Topic | Decision |
|---|---|
| RTL / Arabic | Inherited app `dir`; print layouts + exception queue bilingual; inventory screens keep `labelAr` / `language === 'ar'` |
| ZATCA print | `TransferPrint` — company VAT, bilingual headers, QR from linked invoice (stored or Phase-1 TLV) |

| Negative stock | Default **blocked**. Override via `InvSettings.allowNegativeStock` (global) **or** `InvProductCategory.allowNegativeStock` / product flag. Validate + scrap → `applyQuantDelta` |
| Inventory evaluation | `InvSettings.inventoryEvaluationEnabled` (default true) gates valuation layers + AVCO updates on receipt/delivery/scrap; journals still require `stockAccountingEnabled` |
| ProductStockCache | New `InvProductStockCache` upserted in `syncProductStockCache` (same session when provided); reports still read ledger; scheduler asserts cache == ledger |
| Exception queue | `GET /stock/exceptions` + Operations menu — late waits, scheduler errors / NO_RULE, negative forecast, expired lots on hand |
| Bulk import | Dry-run first; opening qty → **adjustment transfer** (not direct write); `POST /stock/import/locations` added |
| Config audit | `InvConfigAudit` on settings + product-category changes; `GET /stock/config-audit` |
| Idempotency | `Idempotency-Key` middleware on `/api/stock` mutating methods; 24h TTL replay |
| Scheduler | 15‑min rate limit (`status: skipped`); run log includes cache assert counts; fixed annual-inventory `settings` load |

### Deviations
| Deviation | Reason |
|---|---|
| No live ZATCA QR on slips | Superseded — see ZATCA print QR below |
| Cache also mirrors `Product.stocks[]` | Keep legacy list UIs working |
| XLSX import | First sheet → CSV via `xlsx`; same dry-run / adjustment-transfer path (`xlsxBase64` on import APIs) |

## v3 P0 diagnosis (2026-08-25)

### 1.1 Empty transfer lists / 0·0·0 dashboard

**Could not query live Mongo** (no local Docker / `.env` in this environment). Root cause from code + create path:

| Check | Finding |
|---|---|
| Create state | `createTransfer` always saves `state: 'draft'` |
| Overview `/transfer-counts` | Counted only `assigned` · `waiting` · `confirmed` — **never `draft`** |
| Chip links | Overview Ready/Waiting/Confirmed links open lists with `?state=…` that exclude drafts |
| List “Open” (no state) | Should return drafts if OTs resolve; empty chips created the “lists are empty after create” report |
| `$in: []` risk | If no OT matches `code`, list used `operationTypeId: { $in: [] }` → silent empty (no meta) |
| Response shape | `{ data, total }` — client reads `data.data` correctly (not the bug) |
| Tenant typing | Inventory create uses `toObjectId`; list used raw `req.tenantFilter` — normalised via `withTenant` + ObjectId in shared builder |

**Root cause (primary):** **Default state filter / counter mismatch** — dashboard and chip filters ignored `draft`, which is the state of every newly created picking.

**Fix:** Shared `transferQuery.js` for list + counts; counters include `draft`; list `_meta.appliedFilters` + Clear filters empty state; tenant via `withTenant(toObjectId)`.

### 1.2 Config dropdown clip/overlap

**Cause:** Absolute dropdown inside page flow, translucent header, no portal/collision.

**Fix:** `PortalDropdown` → `document.body`, flip + max-height, `INV_Z.navDropdown`, close on outside/Esc/scroll/route.

### 1.3 Warehouses marketing cards

**Cause:** Card UI with Transfer/Adjust/Receive, not a record list.

**Fix:** Table list (name, code, stock path, address, steps, value, active); row → warehouse form; quick actions removed from list (belong on form).

### 1.4 PoS / Manufacturing

**Deviation:** Schema already enums `code: 'pos' | 'manufacturing'` (not `outgoing`+`isPos` / `mrp_operation`). Kept enum; seeded both OTs per warehouse on bootstrap; menu flags default **on**; routes `/inventory/pos` + `/inventory/manufacturing`; `POST /stock/pos/consume` + `/stock/manufacturing/consume-produce`.




## Acceptance pass (post Step 6)

| Gap | Fix |
|---|---|
| Category costing delta before save | `GET /stock/product-categories/:id/costing-preview` + banner/confirm on form |
| Partial validate backorder | Transfer Validate respects OT `createBackorder` (`ask` → confirm, `always`/`never`) |
| Multi-loc off | Locations mutations + putaway create gated; putaway menu needs multi-loc |
| PO approve → Receipt | Draft GRN + draft incoming transfer linked (`GRN.inventoryTransferId` ↔ note/origin) |
| SO approve → Delivery | Draft DN + outgoing transfer; cancel order cancels unstarted DN/GRN/transfers |

## Soft gaps closed

| Topic | Decision |
|---|---|
| Lots on delivery slip | `settingsHints.showLotsOnDeliverySlips` gates lot column on outgoing print |
| Lots on invoices | `showLotsOnInvoices` / `groupLotOnInvoice` → `GET /stock/invoices/:id/lots` from linked transfers/DNs; InvoiceView line hints + lot table (read-only) |
| Delivery email/SMS confirm | Outgoing validate sends partner email/SMS when flags on; stamps `sent`/`failed`/`skipped` on `transfer.note` (post-txn; no ledger write) |
| Product packagings UI | `groupStockPackaging` → menu + `/stock/product-packagings` CRUD; pack qty is metadata (not a quant write) |
| Settings effects registry | Every `SETTINGS_ALLOWED` flag maps to `SETTINGS_EFFECTS`; `GET /stock/settings?include=effects` |
| Carrier stubs | Enabling `moduleCarrier*` upserts `InvDeliveryCarrier` with `installed: false` |
| Reconcile stress | In-memory 100 random ops (FIFO/AVCO/standard) assert zero value/qty drift — no Mongo required |
| ZATCA slip QR | Linked-invoice Phase-1 TLV / stored QR on print — no transmission client |

## Placeholder cleanup

| Screen | Status |
|---|---|
| Packages | Real list + create package/type (`ExtraPages`) |
| Product packagings | List/create/deactivate under Products ▾ when `groupStockPackaging` — qty/barcode metadata only |
| Returns | Done-transfer list → return wizard |
| References | Procurement groups list |
| Delivery methods | Fixed-price carriers CRUD |
| Shipping connectors | Flag status + stub rows (no live APIs) |
| Variants / Attributes | Real pages — see Attributes & variants below |

## Attributes & variants

| Topic | Decision |
|---|---|
| Models | `InvProductAttribute`, `InvAttributeValue`, `InvProductVariant` |
| Stock key | Unchanged — quants/moves use `productId` + `variantId` (never direct write) |
| Generate | Cartesian of active `createVariant` attribute values; skip existing `combinationKey` |
| Transfers | `createTransfer` accepts `line.variantId`; picking prompts when product has variants |
| Settings | `groupProductVariant` gates menu + create APIs |

## ZATCA print QR (Phase-1 TLV)

| Topic | Decision |
|---|---|
| API | `GET /stock/transfers/:id/print-context` — linked DN/GRN/invoice + optional QR payload |
| Payload order | Prefer invoice `zatca.qrCodeData` / `phase2QrCode`; else generate Phase-1 TLV from invoice `grandTotal`/`totalTax` + tenant VAT |
| No invent | No QR without linked invoice totals or stored QR (delivery slip alone is not a tax invoice) |
| Transmission | Still out of scope — no clearance/reporting client |
| Print UI | `TransferPrint` renders QR via `qrcode` when payload exists |

## XLSX import wrap

| Topic | Decision |
|---|---|
| Conversion | `xlsxBufferToCsv` / `resolveImportCsvText` — first sheet only; export `format=xlsx` via `csvTextToXlsxBuffer` |

| APIs | `POST /stock/import/products` + `/locations` accept `xlsxBase64` (or CSV text) |
| Ledger | Unchanged — opening qty still posts adjustment transfers |
| UI | Import & Export: file picker (.csv/.xlsx), target products\|locations |

## Fixed-price carrier rating

| Topic | Decision |
|---|---|
| Rate API | `POST /stock/delivery-carriers/:id/rate` — local only (`fixed` / freeAbove / margin) |
| Live providers | Still stub — `CARRIER_NOT_INSTALLED` / `CARRIER_LIVE_DISABLED` |
| Transfer | `carrierId`, `shippingCost`, `trackingReference` on create/patch; outgoing UI when `groupDeliveryMethods` |
| Ledger | Shipping cost is metadata — never writes quants |

## Batch transfers

| Topic | Decision |
|---|---|
| Flag | `groupBatchTransfer` gates menu + APIs |
| Orchestration | Bulk confirm / check-availability / validate / cancel call existing transfer services per picking |
| Ledger | Unchanged — each validate still goes through move → quant delta |
| UI | `/inventory/batches` list + detail add/remove pickings |

## Quality checks

| Topic | Decision |
|---|---|
| Flag | `moduleQuality` gates menu + APIs + validate gate |
| Points | `InvQualityPoint` per operation type; checks created on confirm (and via ensure) |
| Validate | All checks must be `pass` (`none` and `fail` block) |
| Ledger | Unchanged — quality is a gate before validate → quant delta |
| UI | Quality Points config + Transfer **Quality** tab |

## Reception report

| Topic | Decision |
|---|---|
| Flag | `receptionReportEnabled` / `groupReceptionReport` gates API + menu |
| Data | Done incoming transfers + move lines in period (ledger read) |
| UI | `/inventory/report/reception` in report family |
| Owner picker | When `groupStockTrackingOwner`, transfer form sets `ownerId` (partner) — still dimension on quants |

## Variants edit + GS1 + XLSX export

| Topic | Decision |
|---|---|
| Variants UI | Inline SKU / barcode / active via existing `PATCH /stock/variants/:id` |
| GS1 | Enabling `groupGs1Nomenclature` seeds GTIN/AI rules onto default barcode nomenclature |
| Export | `GET /stock/export/:collection?format=xlsx` wraps CSV via SheetJS — same columns as CSV |

## Delivery email / SMS confirmation

| Topic | Decision |
|---|---|
| Trigger | Outgoing `validateTransfer` post-txn (after quant deltas + cache sync) |
| Email | `sendTenantEmail` to partner `Customer.email` when `emailConfirmationOnDelivery` |
| SMS | `sendSms` to partner phone when `stockSmsConfirmation` + SMS addon + provider enabled |
| Audit | Append `[email|sms-confirmation sent|failed|skipped …]` lines on `transfer.note` |
| Ledger | Unchanged — notify never writes quants |
| SMS settings path | Prefer `settings.communication.sms`, fall back to legacy `settings.sms` |

## Product packagings

| Topic | Decision |
|---|---|
| Flag | `groupStockPackaging` gates menu, GET/POST/PATCH APIs |
| Model | `InvProductPackaging` — product + name + qty (+ optional barcode / package type) |
| UI | `/inventory/product-packagings` list + create + activate/deactivate |
| Ledger | Packaging qty is conversion metadata only — stock still via validate → quant |

## v3 P1 — Physical Inventory rebuild

| Topic | Decision |
|---|---|
| Persist | Counted qty / schedule / assignee saved on blur via `POST /stock/physical-inventory/set` (`isCountSet`) — survives reload |
| Apply | Confirm dialog: lines, ± diffs, valuation impact, accounting date, reason; **one txn per line** via moves ↔ `inventoryLoss` → `applyQuantDelta` only |
| Request a Count | Stamps schedule on quants in scope; optionally creates **zero-qty** quants for missing product×location (shrinkage) |
| History | `GET /physical-inventory/history` — done move lines to/from inventory adjustment |
| Import | Dry-run then fill counted qty only (`location`, `product_sku`, `lot`, `counted_qty`); never auto-applies |
| Export | CSV of current filtered page (universal import/export shell still §2.2) |
| List shape | `{ data, _meta }` with chips All / To count / To apply / Negative / Scheduled this month + pager |

## v3 P1 — Universal Import / Export (§2.2)

| Topic | Decision |
|---|---|
| Shell | One dialog (`ImportExportDialog`) + `InventoryIeButtons`; hub page picks model |
| Registry | `ieRegistry.js` field trees per model; relational one-level (`warehouse/code`) |
| Export | Field picker + import-compatible toggle (forces `id`) + CSV/XLSX; templates per user/model (`InvIeTemplate`) |
| Async | Rows > 5,000 → `InvExportJob` background; poll + download |
| Import | Always dry-run first; column remap; `id`/`external_ref` → update else create; partial success reported |
| Read-only | `stock`, `moves_history`, `valuation`, `transfers` — export only (Import disabled + tooltip) |
| Ledger | Product opening qty still via adjustment transfers; physical inventory import fills counted only |
| Wired | Products, Warehouses, Locations, Stock report, Physical Inventory, Import & Export settings page |

## v3 P1 — Product identity (§2.3)

| Topic | Decision |
|---|---|
| Field | `Product.productId` — immutable human code `P00001` via `InvSequence` code `PRODUCT` (`nextProductId`) — never `count()` |
| Uniqueness | Per-tenant unique on `productId`, `sku`; barcode unique with partial filter (non-empty only) |
| Create | Assigned in `POST /products` and product CSV/IE import; client cannot set/change it |
| Update | Stripped from body; missing codes backfilled on save / bootstrap |
| Backfill | `backfillProductIds` on inventory bootstrap (idempotent; syncs sequence to max existing) |
| Lookup | Import accepts `productId` alongside sku / barcode / external_ref |
| UI | Form header + read-only field + help text; list column; search includes productId |
| Roles | Product ID = system identity · SKU = editable ref · barcode = scan key |

## v3 P1 — Products variants / images / category (§2.4)

| Topic | Decision |
|---|---|
| Variants list | Columns Product ID · Variant · Attribute values · SKU · Barcode · On hand · Forecasted · Cost · Price; filter + IE |
| Generate | Uses product `attributeLines` (Always mode); archives obsolete combos (`active:false`) — never deletes; dry-run warning when archiving |
| Modes | Attribute `createVariantMode`: always / dynamic / never; value `extraPrice`; variant price = template + extras |
| Images | `POST/PATCH /products/:id/images` — sharp WebP full + 256px thumb, EXIF stripped, max 9, 5MB jpg/png/webp |
| Category | `CategoryCombobox` — searchable path, indent by depth, popular top-8, inline create |
| Form tabs | General · Attributes & Variants · Purchase · Inventory · Accounting |
| Stock dims | `computeOnHand`/`computeForecast` accept optional `variantId` |

## v3 P1 — Product Categories CRUD (§2.5)

| Topic | Decision |
|---|---|
| List | Single full-path column (sorted), multi-select, `1–N/N` pager, New + universal IE |
| Actions | Export (selection → IE `ids` filter) · Duplicate · Delete — no “Insert in spreadsheet” |
| Delete guard | Blocked when products or child categories exist; `CAT_IN_USE` + `meta` counts; **Show products** → `/products?categoryId=` |
| Duplicate | Copies logistics/valuation/accounts; name + `" (copy)"`; products not copied |
| Reparent | `updateProductCategory` recomputes path then `cascadeCategoryPaths` via **one** `bulkWrite` for subtree |
| Products list | Honors `?categoryId=` query (filter chip + clear) |

## v3 P1 — Reports family (§2.6)

| Topic | Decision |
|---|---|
| Shell | Shared `ReportShell` — warehouse/date filters, list/pivot/graph view, saved filters (localStorage), IE + CSV |
| Inventory at Date | Stock report `asOf` → `inventoryAtDate`: replay done move lines into internal locs + Σ valuation `value` layers ≤ asOf |
| Stock row actions | **History** → Moves History (`?productId=`) · **Replenishment** → replenishment page |
| Full export | Moves History / Moves Analysis export **full filtered set** (limit 10k / all buckets), not the visible page only |
| As-of edit | Inline On Hand disabled when `asOf` is set (snapshot is read-only) |

## v3 P1 — Settings wiring (§2.7)

| Topic | Decision |
|---|---|
| Ensure accounts | Seeds interim COA only; **validates** automated categories for five accounts (`stockValuation`, `stockInput`, `stockOutput`, `stockJournal`, `expense`) — gaps returned to Settings modal, never invents category links |
| UoM | Categories CRUD + UoM factor/rounding/type; `uomConvert.convertQty` / `demandInProductUom` round **up** on consumption |
| Packagings | CRUD under Products; move line `productPackagingId` × packs → product UoM demand on create |
| Carriers | Stub rows only — explicit “no live API” copy; flag still creates `InvDeliveryCarrier` stub |
| Audit | `updateInvSettings` already writes `recordConfigAudit` per changed flag |
| Tests | Effect map coverage + packaging/lots/signature predicates + UoM round-up + five-key contract |

## v3 P2 — Enterprise hardening (§3.1–3.5 slice)

| Topic | Decision |
|---|---|
| Indexes | Quant `location+product`, `product+inDate`; MoveLine `product+updatedAt`; Transfer `opType+state+scheduled`, `origin`, `backorderOfId`; Move `procurementGroupId` |
| Query budget | `stockQueryBudget` ALS counter + `X-Inv-Query-Count`; fail when `INV_QUERY_BUDGET_FAIL=1` and count > 10 |
| Stock report | `stockReportLive` — 4 queries (quants + pending moves + layers + products), no per-row forecast/value |
| Cursor page | Moves History accepts `cursor` keyset; `_meta.nextCursor` |
| Append-only | Done `InvMove` / `InvMoveLine` blocked; valuation layers **no delete** (remaining* updates still allowed for FIFO) |
| Health | `GET /stock/health` → Overview strip (status, version, waiting past deadline, last scheduler) |
| Idempotency | Already mounted (`Idempotency-Key`) on `/api/stock` mutations |

## v3 P2 — Integrity + jobs + rate limits (§3.6 slice)

| Topic | Decision |
|---|---|
| Integrity suite | `runIntegrityChecks` sample-capped (checks 1–9); check 10 done-checksum **deferred** (no column yet) |
| JobRun | `InvJobRun` persists integrity (and future) runs; `POST /stock/integrity/run`, `GET /stock/integrity/latest`, `GET /stock/jobs` |
| Exceptions | Queue merges latest integrity failures; deadline field is `deadlineDate`; UI **Run checks** |
| Cron | Optional `STOCK_INTEGRITY_CRON=1` → Sunday 03:00 per engine-enabled tenant |
| Rate limit | `stockHeavyLimiter` (30/min/tenant) on export, scheduler run, stock report, moves-analysis, integrity run |
| Repair | Cache mismatches suggest `POST /stock/report/reconcile/repair-cache`; never edit done ledger rows |

## v3 P2 — API contract + Jobs UI (§3.3–3.4 slice)

| Topic | Decision |
|---|---|
| Error envelope | `{ error: { code, message, messageAr, field?, details? } }` via `sendInvError`; FE `getApiErrorMessage` unwraps string or object |
| Typed codes | Catalog in `errors.js` for brief minimum set + bilingual next-step copy; `invError(code)` helper |
| Zod | Pin `zod@^3.25.76` (not v4) so `npm ci` resolves with openai’s optional peer; boundary schemas on validate / pos-consume / apply-count / integrity-run (`invValidate.js`); passthrough unknown keys for FE compat |
| List envelope | `listEnvelope` + dual `{ data, _meta }` / `{ items }` on `GET /stock/jobs` (gradual rollout — not all lists rewritten) |
| Write conflict | `runWithTransaction` one retry + jitter; exhaust → `WRITE_CONFLICT` 409 |
| Advisory lock | Shared `acquireAdvisoryLock` helper (validate still uses transfer `validateLock`) |
| Jobs UI | `/inventory/jobs` lists `InvJobRun`; scheduler success/fail also mirrors into JobRun |

## v3 P2 — Done checksum + perf seed (§3.6 check 10 + §3.7)

| Topic | Decision |
|---|---|
| Checksum | `doneAt` + `doneChecksum` (sha256) stamped on move/line at validate/scrap/count; integrity check 10 samples stamped rows; legacy unstamped counted but not hard-fail |
| Stamp sites | `transferService.validate`, `scrapService.validate`, `inventoryCount` adjustment create |
| Perf seed | `npm run seed:inventory-perf -- --tenant=<id> --profile=smoke\|brief\|full` |
| Profiles | smoke 2/500/1k/100; brief 10/50k/200k list + 5k validated; full = brief sizes with 200k engine validates |
| Stock path | Validated receipts only via create→confirm→validate; list-benchmark transfers are shells (no quant writes) |

## v3 P2 — Completion (BullMQ + envelope + metrics)

| Topic | Decision |
|---|---|
| BullMQ | `inventoryQueue` queue `inventory-jobs`; Redis when available, **inline setImmediate fallback** when `REDIS_ENABLED=false` or enqueue fails |
| Job types | integrity, scheduler, export, cache_reconcile, reservation_retry, expiry_alerts, cyclic_count, delivery_notify (stub) |
| Cron | Scheduler/integrity enqueue via queue; `STOCK_MAINT_CRON=1` runs expiry+cyclic+cache repair+reservation retry daily 04:00 |
| Export | Async IE creates `InvExportJob` then enqueues `export` worker (builds payload + JobRun) |
| List envelope | `sendList` dual `{ data,_meta }` + `{ items,total }` on **all stock list endpoints**; FE uses `asInvList()` |
| Metrics | In-process p50/p95 latency + query counts + job failure rate + write-conflict retries; `GET /stock/metrics` |
| Jobs UI | Quick-enqueue buttons + queue mode strip + metrics line |
| Bench | `npm run bench:inventory-perf -- --tenant=<id>` DB-side timings vs §3.7 targets |
| Engine version | `3.1.0-p2` |
| Delivery SMS/email | Explicitly stubbed JobRun — no live carrier provider |

## v3 P2 — List envelope completion

| Topic | Decision |
|---|---|
| Backend | Every `GET` list under `/api/stock` returns dual envelope via `sendList` (bare arrays retired) |
| Frontend | `frontend/src/lib/invList.js` → `asInvList(payload)` normalizes array / `data` / `items` |
| Compat | Pages that already read `_meta` / `data` (transfers, physical inventory) unchanged |


