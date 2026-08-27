/**
 * Typed inventory error catalog (§3.3).
 * Messages tell the user what to do next — not just what failed.
 */

export const INV_ERROR_CODES = Object.freeze({
  NO_RULE_FOUND: {
    status: 422,
    message: 'No rule found to supply this product at this location. Add a procurement or pull rule on the product route.',
    messageAr: 'لا قاعدة لتوريد هذا المنتج في هذا الموقع. أضف قاعدة توريد أو سحب على مسار المنتج.',
  },
  INSUFFICIENT_STOCK: {
    status: 409,
    message: 'Insufficient stock — not enough quantity available in inventory.',
    messageAr: 'المخزون غير كافٍ — الكمية المتاحة في المخزون أقل من المطلوب.',
  },
  NEGATIVE_STOCK_BLOCKED: {
    status: 409,
    message: 'Negative stock is blocked for this product category. Receive stock first or change the category removal policy.',
    messageAr: 'المخزون السالب محظور لهذه الفئة. استلم المخزون أولاً أو غيّر سياسة الفئة.',
  },
  LOT_REQUIRED: {
    status: 400,
    message: 'A lot or serial number is required for this product. Enter a lot before validating.',
    messageAr: 'يلزم رقم دفعة أو تسلسلي لهذا المنتج. أدخل الدفعة قبل التحقق.',
  },
  DUPLICATE_SERIAL: {
    status: 409,
    message: 'This serial number already exists. Use a unique serial or open the existing lot.',
    messageAr: 'الرقم التسلسلي موجود مسبقاً. استخدم رقماً فريداً أو افتح الدفعة الحالية.',
  },
  PICKING_ALREADY_DONE: {
    status: 409,
    message: 'This transfer is already done and cannot be changed. Create a return or reversing move.',
    messageAr: 'هذا التحويل مكتمل ولا يمكن تعديله. أنشئ مرتجعاً أو حركة عكسية.',
  },
  IMMUTABLE_RECORD: {
    status: 409,
    message: 'Done ledger rows are append-only. Use a reversing move — never edit completed stock moves.',
    messageAr: 'سجلات الحركات المكتملة للقراءة فقط. استخدم حركة عكسية — لا تعدّل الحركات المكتملة.',
  },
  LOCATION_HAS_STOCK: {
    status: 409,
    message: 'This location still has stock. Move or scrap quantities before deactivating or deleting it.',
    messageAr: 'لا يزال لهذا الموقع مخزون. انقل أو أتلف الكميات قبل إلغاء تفعيله أو حذفه.',
  },
  LOC_VIEW_STOCK: {
    status: 422,
    message: 'Cannot post inventory to a View location. View locations are virtual folders — use a child Internal location instead.',
    messageAr: 'لا يمكن ترحيل مخزون إلى موقع من نوع عرض. مواقع العرض مجلدات افتراضية — استخدم موقعاً داخلياً فرعياً.',
  },
  TYPE_LOCKED_BY_HISTORY: {
    status: 409,
    message: 'This operation type has history and cannot change its code or warehouse. Create a new type instead.',
    messageAr: 'نوع العملية له سجل ولا يمكن تغيير رمزه أو مستودعه. أنشئ نوعاً جديداً بدلاً من ذلك.',
  },
  CAPACITY_EXCEEDED: {
    status: 409,
    message: 'Location storage capacity would be exceeded. Choose another location or raise capacity.',
    messageAr: 'ستتجاوز سعة الموقع. اختر موقعاً آخر أو ارفع السعة.',
  },
  WRITE_CONFLICT: {
    status: 409,
    message: 'Another user updated this record at the same time. Refresh and retry the operation.',
    messageAr: 'حدّث مستخدم آخر هذا السجل في الوقت نفسه. حدّث الصفحة وأعد المحاولة.',
  },
  TENANT_SCOPE_VIOLATION: {
    status: 403,
    message: 'This record is outside your tenant scope. Sign in with the correct company or contact support.',
    messageAr: 'هذا السجل خارج نطاق شركتك. سجّل الدخول بالشركة الصحيحة أو تواصل مع الدعم.',
  },
  VALIDATE_LOCK: {
    status: 409,
    message: 'This transfer is locked by another validate or already completed. Wait a moment and refresh.',
    messageAr: 'هذا التحويل مقفل بتحقق آخر أو مكتمل. انتظر قليلاً ثم حدّث الصفحة.',
  },
  VALIDATION: {
    status: 400,
    message: 'Invalid input. Check the highlighted fields and try again.',
    messageAr: 'إدخال غير صالح. راجع الحقول المميزة وأعد المحاولة.',
  },
  RATE_LIMIT: {
    status: 429,
    message: 'Too many inventory heavy requests. Wait a minute and try again.',
    messageAr: 'طلبات مخزون كثيرة. انتظر دقيقة ثم أعد المحاولة.',
  },
});

export class InventoryError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {number} [status]
   * @param {{ messageAr?: string, field?: string, details?: any, meta?: any }} [extra]
   */
  constructor(message, code = 'INVENTORY_ERROR', status = 400, extra = {}) {
    super(message);
    this.name = 'InventoryError';
    this.code = code;
    this.status = status;
    this.messageAr = extra.messageAr;
    this.field = extra.field;
    this.details = extra.details;
    this.meta = extra.meta;
  }
}

export class InventoryValidationError extends InventoryError {
  constructor(message, code = 'VALIDATION', extra = {}) {
    const catalog = INV_ERROR_CODES[code];
    super(
      message || catalog?.message || 'Validation failed',
      code,
      catalog?.status || 400,
      {
        messageAr: extra.messageAr || catalog?.messageAr,
        field: extra.field,
        details: extra.details,
        meta: extra.meta,
      },
    );
    this.name = 'InventoryValidationError';
  }
}

export class InventoryConflictError extends InventoryError {
  constructor(message, code = 'WRITE_CONFLICT', extra = {}) {
    const catalog = INV_ERROR_CODES[code] || INV_ERROR_CODES.WRITE_CONFLICT;
    super(
      message || catalog.message,
      code,
      catalog.status || 409,
      {
        messageAr: extra.messageAr || catalog.messageAr,
        field: extra.field,
        details: extra.details,
        meta: extra.meta,
      },
    );
    this.name = 'InventoryConflictError';
  }
}

/** Build a catalogued inventory error (bilingual + next-step copy). */
export function invError(code, {
  message,
  messageAr,
  field,
  details,
  meta,
  status,
} = {}) {
  const catalog = INV_ERROR_CODES[code] || {};
  return new InventoryError(
    message || catalog.message || code,
    code,
    status || catalog.status || 400,
    {
      messageAr: messageAr || catalog.messageAr,
      field,
      details,
      meta,
    },
  );
}

export function toErrorBody(err) {
  const catalog = INV_ERROR_CODES[err?.code] || {};
  const details = err?.details != null || err?.meta
    ? { ...(typeof err.details === 'object' && err.details ? err.details : {}), ...(err.meta || {}) }
    : undefined;
  return {
    code: err?.code || 'INVENTORY_ERROR',
    message: err?.message || 'Inventory error',
    messageAr: err?.messageAr || catalog.messageAr || err?.message || 'خطأ في المخزون',
    ...(err?.field ? { field: err.field } : {}),
    ...(details && Object.keys(details).length ? { details } : {}),
  };
}
