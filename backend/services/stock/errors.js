export class StockError extends Error {
  /** @param {string} message @param {string} code @param {number} [status] */
  constructor(message, code = 'STOCK_ERROR', status = 400) {
    super(message);
    this.name = 'StockError';
    this.code = code;
    this.status = status;
  }
}

export class StockValidationError extends StockError {
  constructor(message, code = 'VALIDATION') {
    super(message, code, 400);
    this.name = 'StockValidationError';
  }
}

export class StockConflictError extends StockError {
  constructor(message, code = 'CONFLICT') {
    super(message, code, 409);
    this.name = 'StockConflictError';
  }
}
