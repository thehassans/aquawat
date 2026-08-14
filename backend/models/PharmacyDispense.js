import mongoose from 'mongoose';

const pharmacyDispenseSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  invoiceNumber: { type: String },
  dispensedAt: { type: Date, default: Date.now },
  patientName: { type: String, default: '' },
  patientIdNumber: { type: String, default: '' },
  prescriptionNumber: { type: String, default: '' },
  prescriberName: { type: String, default: '' },
  pharmacistNote: { type: String, default: '' },
  hasControlled: { type: Boolean, default: false },
  hasPrescription: { type: Boolean, default: false },
  lines: [{
    productId: { type: mongoose.Schema.Types.ObjectId },
    productName: { type: String },
    quantity: { type: Number, default: 0 },
    batchNumber: { type: String, default: '' },
    sfdaRegisterNumber: { type: String, default: '' },
    requiresPrescription: { type: Boolean, default: false },
    isControlled: { type: Boolean, default: false },
  }],
  dispensedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

pharmacyDispenseSchema.index({ tenantId: 1, dispensedAt: -1 });
pharmacyDispenseSchema.index({ tenantId: 1, hasControlled: 1, dispensedAt: -1 });

export default mongoose.models.PharmacyDispense || mongoose.model('PharmacyDispense', pharmacyDispenseSchema);
