/**
 * Receipts Operation — TypeScript data models.
 * Maps Odoo-style incoming transfers (Draft → Ready → Done).
 */

export type TransferState =
  | 'draft'
  | 'waiting'
  | 'confirmed'
  | 'assigned'
  | 'partiallyAvailable'
  | 'done'
  | 'cancelled'

/** UI-facing receipt state (collapsed from backend transfer states). */
export type ReceiptUiState = 'draft' | 'ready' | 'done' | 'cancelled' | 'waiting'

export interface Location {
  _id: string
  name: string
  nameAr?: string
  completePath: string
  usage:
    | 'view'
    | 'internal'
    | 'vendor'
    | 'customer'
    | 'inventoryLoss'
    | 'scrap'
    | 'production'
    | 'transit'
  warehouseId?: string | { _id: string; code?: string; nameEn?: string; name?: string } | null
  active?: boolean
}

export interface OperationType {
  _id: string
  name: string
  nameAr?: string
  code: string
  warehouseId: string | { _id: string; code?: string; nameEn?: string; name?: string }
  defaultSourceLocationId?: string | null
  defaultDestLocationId?: string | null
  createBackorder?: 'ask' | 'always' | 'never'
  active?: boolean
}

export interface TransferLineItem {
  _id?: string
  productId?: string | {
    _id: string
    nameEn?: string
    nameAr?: string
    sku?: string
    barcode?: string
    unitOfMeasure?: string
  }
  variantId?: string | { _id: string; name?: string } | null
  uomId?: string | { _id: string; name?: string; nameAr?: string } | null
  demandQty: number | string
  doneQty?: number | string
  state?: TransferState
  sourceLocationId?: string | Location
  destLocationId?: string | Location
}

export interface TransferPartner {
  _id: string
  name?: string
  nameEn?: string
  nameAr?: string
  stockWarn?: 'block' | 'warning' | string
  stockWarnMsg?: string
}

export interface Transfer {
  _id: string
  name: string
  state: TransferState
  operationTypeId?: OperationType | string
  partnerId?: string | null
  partner?: TransferPartner | null
  sourceLocationId?: Location | string
  destLocationId?: Location | string
  scheduledDate?: string | null
  deadlineDate?: string | null
  origin?: string
  note?: string
  priority?: 'normal' | 'urgent'
  moves?: TransferLineItem[]
  createBackorder?: 'ask' | 'always' | 'never'
  settingsHints?: Record<string, boolean>
}

export interface DraftLine {
  productId: string
  productName?: string
  sku?: string
  demandQty: string
  variantId?: string | null
  variantName?: string
  variants?: Array<{ _id: string; name: string }>
  needsVariant?: boolean
  uomId?: string
  uomLabel?: string
}

export interface ReceiptFormValues {
  operationTypeId: string
  partnerId: string
  sourceLocationId: string
  destLocationId: string
  scheduledDate: string
  deadlineDate: string
  origin: string
  note: string
  priority: 'normal' | 'urgent'
  lines: DraftLine[]
}

export interface WarehouseLite {
  _id: string
  code?: string
  nameEn?: string
  nameAr?: string
  name?: string
}

export interface OpTypeGroup {
  warehouseId: string
  warehouseLabel: string
  options: OperationType[]
}
