import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  nameAr: { type: String },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvProductCategory', default: null },
  completePath: { type: String, required: true },
  routeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InvRoute' }],
  forceRemovalStrategy: {
    type: String,
    enum: ['fifo', 'lifo', 'fefo', 'closest'],
    default: undefined,
  },
  reservePackagings: { type: String, enum: ['fullOnly', 'partial'], default: 'partial' },
  costingMethod: { type: String, enum: ['standard', 'fifo', 'average'], default: 'average' },
  valuationMode: { type: String, enum: ['manual', 'automated'], default: 'automated' },
  incomeAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount' },
  expenseAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount' },
  priceDifferenceAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount' },
  stockValuationAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount' },
  stockJournalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Journal' },
  stockInputAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount' },
  stockOutputAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount' },
  /** Legacy Product.category string this was promoted from */
  legacyName: { type: String },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, completePath: 1 }, { unique: true });
schema.index({ tenantId: 1, legacyName: 1 });
schema.index({ tenantId: 1, parentId: 1 });

export default mongoose.models.InvProductCategory || mongoose.model('InvProductCategory', schema);
