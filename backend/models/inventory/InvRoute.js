import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  nameAr: { type: String },
  sequence: { type: Number, default: 10 },
  active: { type: Boolean, default: true },
  productSelectable: { type: Boolean, default: true },
  categorySelectable: { type: Boolean, default: true },
  warehouseSelectable: { type: Boolean, default: true },
  packagingSelectable: { type: Boolean, default: false },
  /** When true, route can be chosen on sales order lines */
  saleOrderSelectable: { type: Boolean, default: false },
  warehouseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' }],
  suppliedWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  supplierWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, name: 1 });
schema.index({ tenantId: 1, sequence: 1, active: 1 });

export default mongoose.models.InvRoute || mongoose.model('InvRoute', schema);
