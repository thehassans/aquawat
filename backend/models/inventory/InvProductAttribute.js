import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true, trim: true },
  nameAr: { type: String, trim: true },
  /** When true, values participate in variant cartesian generation */
  createVariant: { type: Boolean, default: true },
  /**
   * always = cartesian on generate
   * dynamic = create on demand when used
   * never = informational only (no variant)
   */
  createVariantMode: {
    type: String,
    enum: ['always', 'dynamic', 'never'],
    default: 'always',
  },
  displayType: {
    type: String,
    enum: ['radio', 'select', 'color', 'pill', 'image'],
    default: 'select',
  },
  sequence: { type: Number, default: 10 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ tenantId: 1, name: 1 }, { unique: true });
schema.index({ tenantId: 1, active: 1, sequence: 1 });

export default mongoose.models.InvProductAttribute
  || mongoose.model('InvProductAttribute', schema);
