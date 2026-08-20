import mongoose from 'mongoose';

const marqueePackageItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true, trim: true },
  itemNameAr: { type: String, trim: true },
  category: {
    type: String,
    enum: [
      'welcome_drinks',
      'starters',
      'bbq',
      'main_course',
      'rice_dishes',
      'breads',
      'salads_sauces',
      'desserts',
      'beverages',
      'stage_decor',
      'lighting_sound',
      'hall_services',
      'bridal_services',
      'photography',
      'other',
    ],
    default: 'main_course',
  },
  portionSize: { type: String, default: '1 per head' },
  notes: { type: String, trim: true },
}, { _id: true });

const marqueePackageSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  nameAr: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    enum: ['wedding', 'reception', 'valima', 'mehndi', 'corporate', 'birthday', 'engagement', 'exhibition', 'qawwali_dinner', 'other'],
    default: 'wedding',
  },
  description: { type: String, trim: true },
  descriptionAr: { type: String, trim: true },
  items: [marqueePackageItemSchema],
  ratePerHead: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  hallBaseRent: {
    type: Number,
    min: 0,
    default: 0,
  },
  minGuests: {
    type: Number,
    min: 1,
    default: 50,
  },
  maxGuests: {
    type: Number,
    min: 1,
    default: 2000,
  },
  currency: {
    type: String,
    default: 'SAR',
  },
  taxRate: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  bannerImage: {
    type: String,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

marqueePackageSchema.index({ tenantId: 1, category: 1, isActive: 1 });
marqueePackageSchema.index({ tenantId: 1, name: 1 });

export default mongoose.model('MarqueePackage', marqueePackageSchema);
