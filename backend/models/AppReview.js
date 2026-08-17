import mongoose from 'mongoose';

const appReviewSchema = new mongoose.Schema(
  {
    appId: {
      type: String,
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: {
      type: String,
      default: '',
      trim: true,
    },
    tenantName: {
      type: String,
      default: '',
      trim: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    comment: {
      type: String,
      default: '',
      trim: true,
    },
    isVerifiedInstaller: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index so each tenant can have one review per app
appReviewSchema.index({ appId: 1, tenantId: 1 }, { unique: true });

const AppReview = mongoose.model('AppReview', appReviewSchema);

export default AppReview;
