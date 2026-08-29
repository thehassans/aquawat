import mongoose from 'mongoose';

const salesTeamSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  nameAr: { type: String, trim: true, default: '' },
  code: { type: String, trim: true, default: '' },
  description: { type: String, default: '' },
  memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  leaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  /** Monthly revenue target in tenant currency */
  monthlyTarget: { type: Number, default: 0, min: 0 },
  /** Quarterly revenue target */
  quarterlyTarget: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
  /** Channel / fulfillment style for the team */
  teamType: {
    type: String,
    enum: ['field', 'pos', 'kiosk', 'ecommerce', 'other'],
    default: 'field',
    index: true,
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

salesTeamSchema.index({ tenantId: 1, name: 1 });
salesTeamSchema.index({ tenantId: 1, code: 1 }, { unique: true, sparse: true });

export default mongoose.model('SalesTeam', salesTeamSchema);
