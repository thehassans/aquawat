import mongoose from 'mongoose';

const warehouseSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  
  code: { type: String, required: true },
  nameEn: { type: String, required: true },
  nameAr: { type: String },
  type: {
    type: String,
    enum: ['main', 'branch', 'distribution', 'returns', 'virtual'],
    default: 'main'
  },
  
  address: {
    street: { type: String },
    district: { type: String },
    city: { type: String },
    postalCode: { type: String },
    country: { type: String, default: 'SA' },
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number }
    }
  },
  
  contact: {
    managerName: { type: String },
    phone: { type: String },
    email: { type: String }
  },
  
  capacity: {
    totalSpace: { type: Number },
    usedSpace: { type: Number, default: 0 },
    unit: { type: String, default: 'sqm' }
  },
  
  operatingHours: {
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String }
  },
  
  isActive: { type: Boolean, default: true },
  isPrimary: { type: Boolean, default: false },

  // Inventory engine (locations + multi-step). Null until bootstrapped.
  viewLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation' },
  stockLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation' },
  inputLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation' },
  qualityLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation' },
  packingLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation' },
  outputLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation' },
  receptionSteps: { type: String, enum: ['one', 'two', 'three'], default: 'one' },
  deliverySteps: { type: String, enum: ['ship', 'pickShip', 'pickPackShip'], default: 'ship' },
  buyToResupply: { type: Boolean, default: true },
  resupplyFromWarehouseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' }],
  engineBootstrappedAt: { type: Date },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

warehouseSchema.index({ tenantId: 1, code: 1 }, { unique: true });
warehouseSchema.index({ tenantId: 1, stockLocationId: 1 });


const Warehouse = mongoose.model('Warehouse', warehouseSchema);
export default Warehouse;
