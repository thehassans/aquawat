import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const productTemplateSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  defaultCode: { type: String },
  barcode: { type: String },
  type: { type: String, enum: ['goods', 'service', 'combo'], default: 'goods' },
  isStorable: { type: Boolean, default: true },
  tracking: { type: String, enum: ['none', 'lot', 'serial'], default: 'none' },
  useExpirationDate: { type: Boolean, default: false },
  expirationTime: { type: Number, default: 0 },
  useTime: { type: Number, default: 0 },
  removalTime: { type: Number, default: 0 },
  alertTime: { type: Number, default: 0 },
  uomId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockUom', required: true },
  purchaseUomId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockUom' },
  listPrice: { ...decimalField, default: '0' },
  standardPrice: { ...decimalField, default: '0' },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductCategory' },
  routeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockRoute' }],
  saleOk: { type: Boolean, default: true },
  purchaseOk: { type: Boolean, default: true },
  weight: { ...decimalField, default: '0' },
  volume: { ...decimalField, default: '0' },
  descriptionPicking: { type: String },
  active: { type: Boolean, default: true },
}, { timestamps: true });

productTemplateSchema.index({ tenantId: 1, defaultCode: 1 });
productTemplateSchema.index({ tenantId: 1, barcode: 1 });
productTemplateSchema.index({ tenantId: 1, name: 'text', defaultCode: 'text' });

export default mongoose.models.StockProductTemplate
  || mongoose.model('StockProductTemplate', productTemplateSchema);
