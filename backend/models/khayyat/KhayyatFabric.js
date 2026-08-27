import mongoose from 'mongoose';

const khayyatFabricSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  madeIn: {
    type: String,
    default: '',
    trim: true
  },
  pricePerRoll: {
    type: Number,
    default: 0,
    min: 0
  },
  rollsInStock: {
    type: Number,
    default: 0,
    min: 0
  },
  stockMeters: {
    type: Number,
    default: 0,
    min: 0
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

khayyatFabricSchema.index({ tenantId: 1, createdAt: -1 });

khayyatFabricSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('KhayyatFabric', khayyatFabricSchema);
