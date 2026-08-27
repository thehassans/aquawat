import mongoose from 'mongoose';

const khataAccountSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
  balance: { type: Number, default: 0 }, // Positive means customer owes money
  creditLimit: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' }
}, { timestamps: true });

export default mongoose.models.KhataAccount || mongoose.model('KhataAccount', khataAccountSchema);
