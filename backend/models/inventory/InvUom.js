import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  nameAr: { type: String },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvUomCategory', required: true },
  uomType: { type: String, enum: ['reference', 'bigger', 'smaller'], default: 'reference' },
  factor: { ...decimalField, default: '1' },
  rounding: { ...decimalField, default: '0.01' },
  active: { type: Boolean, default: true },
  /** Maps legacy Product.unitOfMeasure string codes */
  externalCode: { type: String },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, categoryId: 1, name: 1 }, { unique: true });
schema.index({ tenantId: 1, externalCode: 1 });
schema.index({ tenantId: 1, active: 1 });

export default mongoose.models.InvUom || mongoose.model('InvUom', schema);
