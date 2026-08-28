import mongoose from 'mongoose';

const templateLineSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvProductVariant', default: null },
  productName: { type: String, default: '' },
  quantity: { type: Number, default: 1, min: 0 },
  unitPrice: { type: Number, default: 0, min: 0 },
  description: { type: String, default: '' },
}, { _id: true });

const quotationTemplateSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  nameAr: { type: String, trim: true, default: '' },
  headerHtml: { type: String, default: '' },
  footerHtml: { type: String, default: '' },
  terms: { type: String, default: '' },
  lines: { type: [templateLineSchema], default: [] },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

quotationTemplateSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.model('QuotationTemplate', quotationTemplateSchema);
