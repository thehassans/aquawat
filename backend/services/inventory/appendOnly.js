import { InventoryValidationError } from './errors.js';

/**
 * Append-only enforcement for done ledger documents.
 * Allows first transition into `done`; blocks any later mutation.
 */
export function installAppendOnlyGuard(schema, { stateField = 'state', doneValue = 'done', code = 'IMMUTABLE_RECORD' } = {}) {
  schema.pre('save', async function appendOnlySave(next) {
    try {
      if (this.isNew) return next();
      const prior = await this.constructor.findById(this._id).select(stateField).lean();
      if (prior && prior[stateField] === doneValue) {
        return next(new InventoryValidationError(
          'Done ledger records are append-only and cannot be modified',
          code,
        ));
      }
      return next();
    } catch (err) {
      return next(err);
    }
  });

  async function blockDoneUpdates(next) {
    try {
      const filter = this.getFilter?.() || {};
      const hit = await this.model.findOne({ ...filter, [stateField]: doneValue }).select('_id').lean();
      if (hit) {
        return next(new InventoryValidationError(
          'Done ledger records are append-only and cannot be modified',
          code,
        ));
      }
      return next();
    } catch (err) {
      return next(err);
    }
  }

  schema.pre('findOneAndUpdate', blockDoneUpdates);
  schema.pre('updateOne', blockDoneUpdates);
  schema.pre('updateMany', blockDoneUpdates);
  schema.pre('replaceOne', blockDoneUpdates);
}

/** Valuation layers may update remaining* during FIFO consumption but must never be deleted. */
export function installNoDeleteGuard(schema, { code = 'IMMUTABLE_RECORD' } = {}) {
  const block = function blockDelete(next) {
    next(new InventoryValidationError(
      'Valuation layers cannot be deleted — reverse with a correcting move',
      code,
    ));
  };
  schema.pre('findOneAndDelete', block);
  schema.pre('deleteOne', block);
  schema.pre('deleteMany', block);
}
