import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const routeSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  sequence: { type: Number, default: 10 },
  active: { type: Boolean, default: true },
  productSelectable: { type: Boolean, default: true },
  productCategSelectable: { type: Boolean, default: true },
  warehouseSelectable: { type: Boolean, default: true },
  packagingSelectable: { type: Boolean, default: false },
  warehouseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockWarehouse' }],
  suppliedWhId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockWarehouse', default: null },
  supplierWhId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockWarehouse', default: null },
}, { timestamps: true });

routeSchema.index({ tenantId: 1, name: 1 });
routeSchema.index({ tenantId: 1, sequence: 1 });

export default mongoose.models.StockRoute || mongoose.model('StockRoute', routeSchema);
