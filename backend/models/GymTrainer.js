import mongoose from 'mongoose';

const gymTrainerSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  nameEn: { type: String, required: true },
  nameAr: { type: String },
  phone: { type: String },
  email: { type: String },
  photoUrl: { type: String },
  specializations: [{ 
    type: String, 
    enum: ['weight_loss', 'muscle_gain', 'functional', 'yoga', 'boxing', 'rehabilitation', 'nutrition', 'crossfit', 'pilates', 'swimming', 'martial_arts', 'cardio', 'strength', 'flexibility']
  }],
  certifications: [{ 
    name: { type: String },
    issuer: { type: String },
    year: { type: Number }
  }],
  commissionPercent: { type: Number, default: 40 },
  bioEn: { type: String },
  bioAr: { type: String },
  isActive: { type: Boolean, default: true },
  branchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

gymTrainerSchema.index({ tenantId: 1, isActive: 1 });

export default mongoose.models.GymTrainer || mongoose.model('GymTrainer', gymTrainerSchema);
