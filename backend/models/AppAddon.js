import mongoose from 'mongoose';

const appAddonSchema = new mongoose.Schema({
  appId: { type: String, required: true, unique: true, index: true },
  nameEn: { type: String, required: true },
  nameAr: { type: String, required: true },
  taglineEn: { type: String, required: true },
  taglineAr: { type: String, required: true },
  descriptionEn: { type: String, required: true },
  descriptionAr: { type: String, required: true },
  category: {
    type: String,
    enum: [
      'industry_verticals',
      'manufacturing',
      'pos_retail',
      'saudi_compliance',
      'hardware_iot',
      'automation_comm',
      'ai_intelligence',
      'ecommerce_payments',
      'finance_accounting',
      'hr_manpower'
    ],
    required: true,
    index: true
  },
  appType: {
    type: String,
    enum: [
      'core_vertical',
      'hardware_integration',
      'saudi_compliance',
      'automation_comm',
      'ai_tool',
      'premium_addon'
    ],
    required: true,
    index: true
  },
  icon: { type: String, default: 'layers' },
  version: { type: String, default: '2.4.0' },
  author: { type: String, default: 'Maqder Core' },
  rating: { type: Number, default: 4.9 },
  reviewsCount: { type: Number, default: 128 },
  pricingTier: {
    type: String,
    enum: ['free', 'paid', 'enterprise'],
    default: 'free'
  },
  monthlyPrice: { type: Number, default: 0 },
  yearlyPrice: { type: Number, default: 0 },
  downloadSize: { type: String, default: '3.2 MB' },
  badge: { type: String, default: 'Popular' }, // 'Popular', 'Verified', 'New', 'Pro', 'Enterprise'
  featuresEn: [{ type: String }],
  featuresAr: [{ type: String }],
  defaultRoute: { type: String, default: '' },
  businessTypeGrant: { type: String, default: '' }, // e.g. 'manufacturing', 'bakala', 'restaurant'
  requiresHardware: { type: Boolean, default: false },
  configSchema: [{
    key: { type: String, required: true },
    labelEn: { type: String, required: true },
    labelAr: { type: String, required: true },
    type: { type: String, enum: ['text', 'password', 'boolean', 'select', 'number'], default: 'text' },
    defaultValue: { type: mongoose.Schema.Types.Mixed },
    options: [{ value: String, labelEn: String, labelAr: String }],
    helpTextEn: { type: String, default: '' },
    helpTextAr: { type: String, default: '' }
  }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const AppAddon = mongoose.model('AppAddon', appAddonSchema);
