export class InventoryError extends Error {
  /** @param {string} message @param {string} code @param {number} [status] */
  constructor(message, code = 'INVENTORY_ERROR', status = 400) {
    super(message);
    this.name = 'InventoryError';
    this.code = code;
    this.status = status;
  }
}

export class InventoryValidationError extends InventoryError {
  constructor(message, code = 'VALIDATION') {
    super(message, code, 400);
    this.name = 'InventoryValidationError';
  }
}

export class InventoryConflictError extends InventoryError {
  constructor(message, code = 'CONFLICT') {
    super(message, code, 409);
    this.name = 'InventoryConflictError';
  }
}
