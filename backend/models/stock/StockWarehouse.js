import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const stockWarehouseSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  code: { type: String, required: true },
  legacyWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  viewLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation' },
  lotStockId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation' },
  whInputId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', default: null },
  whQcId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', default: null },
  whPackId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', default: null },
  whOutputId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', default: null },
  receptionSteps: { type: String, enum: ['one_step', 'two_steps', 'three_steps'], default: 'one_step' },
  deliverySteps: { type: String, enum: ['ship_only', 'pick_ship', 'pick_pack_ship'], default: 'ship_only' },
  buyToResupply: { type: Boolean, default: true },
  resupplyWarehouseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockWarehouse' }],
  sequencePrefix: { type: String, default: 'WH' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

stockWarehouseSchema.index({ tenantId: 1, code: 1 }, { unique: true });
stockWarehouseSchema.index({ tenantId: 1, legacyWarehouseId: 1 }, { sparse: true });

export default mongoose.models.StockWarehouse || mongoose.model('StockWarehouse', stockWarehouseSchema);
