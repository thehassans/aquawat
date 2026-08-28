import mongoose from 'mongoose';

/** Global color-coded tags for SOs, products, partners, opportunities */
const salesTagSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  nameAr: { type: String, trim: true, default: '' },
  color: { type: String, required: true, trim: true, default: '#14b8a6' },
  scope: {
    type: String,
    enum: ['sales_order', 'quotation', 'partner', 'product', 'opportunity', 'all'],
    default: 'all',
  },
  /** product_structure | sales_type | priority | custom */
  category: {
    type: String,
    enum: ['product_structure', 'sales_type', 'priority', 'custom'],
    default: 'custom',
  },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

salesTagSchema.index({ tenantId: 1, name: 1, scope: 1 }, { unique: true });

export default mongoose.model('SalesTag', salesTagSchema);
