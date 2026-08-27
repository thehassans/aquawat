import mongoose from 'mongoose';
import crypto from 'crypto';

const measurementSchema = new mongoose.Schema({
  length: { type: Number, default: null },
  shoulderWidth: { type: Number, default: null },
  chest: { type: Number, default: null },
  waist: { type: Number, default: null },
  hips: { type: Number, default: null },
  sleeveLength: { type: Number, default: null },
  bicep: { type: Number, default: null },
  forearm: { type: Number, default: null },
  neck: { type: Number, default: null },
  wrist: { type: Number, default: null },
  cuffWidth: { type: Number, default: null },
  expansion: { type: Number, default: null },
  armhole: { type: Number, default: null },
  bottom: { type: Number, default: null }
}, { _id: false });

const styleOptionsSchema = new mongoose.Schema({
  collar: { type: String, default: null },
  bain: { type: String, default: null },
  cuff: { type: String, default: null },
  pocket: { type: String, default: null },
  buttons: { type: String, default: null },
  embroidery: { type: String, default: null }
}, { _id: false });

const embroideryDesignSnapshotSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  image: { type: String, default: null },
  imageUpdatedAt: { type: Number, default: null }
}, { _id: false });

const khayyatStitchingSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
    required: true
  },
  customerName: {
    type: String,
    default: ''
  },
  customerPhone: {
    type: String,
    default: ''
  },
  relationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
    default: null
  },
  relationName: {
    type: String,
    default: null
  },
  relationType: {
    type: String,
    default: null
  },
  orderFor: {
    type: String,
    default: null
  },
  orderForAr: {
    type: String,
    default: null
  },
  orderForPhone: {
    type: String,
    default: null
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KhayyatWorker',
    default: null
  },
  orderNumber: {
    type: String,
    default: null
  },
  receiptNumber: {
    type: String,
    required: true
  },
  oldInvoiceNumber: {
    type: String,
    default: ''
  },
  thawbType: {
    type: String,
    enum: ['saudi', 'qatari', 'emirati', 'kuwaiti', 'omani', 'bahraini', 'noum'],
    default: 'saudi'
  },
  fabricColor: {
    type: String,
    enum: ['white', 'cream', 'offwhite', 'beige', 'grey', 'black', 'navy', 'brown', null],
    default: null
  },
  fabricId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KhayyatFabric',
    default: null
  },
  customFabricName: {
    type: String,
    default: ''
  },
  rollsUsed: {
    type: Number,
    default: 0,
    min: 0
  },
  measurements: {
    type: measurementSchema,
    default: () => ({})
  },
  styleOptions: {
    type: styleOptionsSchema,
    default: () => ({})
  },
  embroideryDesignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KhayyatEmbroideryDesign',
    default: null
  },
  embroideryDesign: {
    type: embroideryDesignSnapshotSchema,
    default: () => ({})
  },
  measurementImage: {
    type: String,
    default: null
  },
  measurementImageUpdatedAt: {
    type: Number,
    default: null
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in_progress', 'completed', 'delivered', 'stitching', 'finishing', 'laundry', 'done'],
    default: 'pending'
  },
  description: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  dueDate: {
    type: Date,
    default: null
  },
  completedDate: {
    type: Date,
    default: null
  },
  deliveredDate: {
    type: Date,
    default: null
  },
  workerPaid: {
    type: Boolean,
    default: false
  },
  workerEarningsCredited: {
    type: Boolean,
    default: false
  },
  zatcaStatus: {
    type: String,
    enum: ['PENDING', 'REPORTED', 'CLEARED', 'FAILED', null],
    default: null
  },
  zatcaResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  zatcaReportedAt: {
    type: Date,
    default: null
  },
  zatcaUUID: {
    type: String,
    default: null
  },
  zatcaInvoiceHash: {
    type: String,
    default: null
  },
  trackToken: {
    type: String,
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

khayyatStitchingSchema.index({ tenantId: 1, receiptNumber: 1 }, { unique: true });
khayyatStitchingSchema.index({ tenantId: 1, oldInvoiceNumber: 1 });
khayyatStitchingSchema.index({ tenantId: 1, status: 1 });
khayyatStitchingSchema.index({ workerId: 1, status: 1 });
khayyatStitchingSchema.index({ trackToken: 1 }, { unique: true, sparse: true });

export function createTrackToken() {
  return crypto.randomBytes(24).toString('base64url');
}

khayyatStitchingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (!this.trackToken) {
    this.trackToken = createTrackToken();
  }
  next();
});

const KhayyatStitching = mongoose.model('KhayyatStitching', khayyatStitchingSchema);

const MISSING_TOKEN = {
  $or: [{ trackToken: { $exists: false } }, { trackToken: null }, { trackToken: '' }],
};

export async function backfillMissingTrackTokens(limit = 2000) {
  const rows = await KhayyatStitching.find(MISSING_TOKEN).select('_id').limit(limit).lean();
  if (!rows.length) return 0;
  const ops = rows.map((row) => ({
    updateOne: {
      filter: { _id: row._id, ...MISSING_TOKEN },
      update: { $set: { trackToken: createTrackToken() } },
    },
  }));
  const result = await KhayyatStitching.bulkWrite(ops, { ordered: false });
  return result.modifiedCount || result.nModified || ops.length;
}

export default KhayyatStitching;
