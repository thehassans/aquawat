import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const ruleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  pattern: { type: String, required: true }, // JS regex source
  type: {
    type: String,
    enum: ['product', 'lot', 'package', 'location', 'weight', 'price', 'any'],
    default: 'any',
  },
  encoding: { type: String, default: 'any' },
  sequence: { type: Number, default: 10 },
  active: { type: Boolean, default: true },
}, { _id: true });

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  nameAr: { type: String },
  isDefault: { type: Boolean, default: false },
  rules: [ruleSchema],
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.models.InvBarcodeNomenclature
  || mongoose.model('InvBarcodeNomenclature', schema);

/**
 * Test a barcode against nomenclature rules (first match wins by sequence).
 */
export function matchBarcode(nomenclature, barcode) {
  const code = String(barcode || '');
  const rules = [...(nomenclature?.rules || [])]
    .filter((r) => r.active !== false)
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  for (const rule of rules) {
    try {
      const re = new RegExp(rule.pattern);
      if (re.test(code)) {
        return { matched: true, rule };
      }
    } catch {
      // invalid pattern — skip
    }
  }
  return { matched: false, rule: null };
}
