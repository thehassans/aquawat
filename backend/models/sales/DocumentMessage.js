import mongoose from 'mongoose';

const documentMessageSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  docType: {
    type: String,
    enum: ['sales_order', 'delivery_note', 'invoice', 'purchase_order', 'quotation'],
    required: true,
    index: true,
  },
  docId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  kind: { type: String, enum: ['note', 'system'], default: 'note' },
  body: { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

documentMessageSchema.index({ tenantId: 1, docType: 1, docId: 1, createdAt: -1 });

export default mongoose.model('DocumentMessage', documentMessageSchema);
