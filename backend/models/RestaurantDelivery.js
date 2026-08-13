import mongoose from 'mongoose';

// Platform configuration (one per platform per tenant)
const deliveryPlatformConfigSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },

  platform: {
    type: String,
    enum: ['jahez', 'hungerstation', 'ninja', 'keeta', 'mrsool', 'jumlaty', 'toyou', 'direct'],
    required: true,
    index: true,
  },

  // Display
  displayName: { type: String }, // custom name e.g., "Jahez - Branch 1"

  // API credentials
  credentials: {
    apiKey: { type: String },
    apiSecret: { type: String },
    merchantId: { type: String },
    branchId: { type: String }, // platform's branch ID
    webhookSecret: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
    tokenExpiresAt: { type: Date },
  },

  // Webhook
  webhookUrl: { type: String }, // generated URL for receiving orders
  webhookActive: { type: Boolean, default: true },

  // Sync settings
  autoAcceptOrders: { type: Boolean, default: false },
  autoSyncMenu: { type: Boolean, default: false },
  pollIntervalSeconds: { type: Number, default: 60 },

  // Commission
  commissionPercent: { type: Number, default: 0 }, // platform commission %
  commissionFixed: { type: Number, default: 0 }, // fixed commission per order
  deliveryFeeChargedTo: { type: String, enum: ['customer', 'restaurant', 'split'], default: 'customer' },

  // Menu mapping
  menuMapping: [{
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'RestaurantMenuItem' },
    platformItemId: { type: String }, // ID on the platform
    platformItemName: { type: String },
    isActive: { type: Boolean, default: true },
  }],

  // Status
  isConnected: { type: Boolean, default: false },
  lastSyncAt: { type: Date },
  lastOrderAt: { type: Date },
  isActive: { type: Boolean, default: true },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

deliveryPlatformConfigSchema.index({ tenantId: 1, platform: 1, branchId: 1 }, { unique: true, sparse: true });

// Unified delivery order (from any platform)
const deliveryOrderSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },

  // Platform info
  platform: {
    type: String,
    enum: ['jahez', 'hungerstation', 'ninja', 'keeta', 'mrsool', 'jumlaty', 'toyou', 'direct'],
    required: true,
    index: true,
  },
  platformConfigId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPlatformConfig' },
  platformOrderId: { type: String, required: true }, // order ID from the platform
  platformOrderNumber: { type: String }, // display order number

  // Customer info
  customerName: { type: String },
  customerPhone: { type: String },
  customerEmail: { type: String },

  // Delivery address
  deliveryAddress: {
    street: { type: String },
    building: { type: String },
    floor: { type: String },
    apartment: { type: String },
    landmark: { type: String },
    district: { type: String },
    city: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    notes: { type: String },
  },

  // Items
  items: [{
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'RestaurantMenuItem' },
    platformItemId: { type: String },
    name: { type: String, required: true },
    nameAr: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    notes: { type: String },
    modifications: [{ type: String }], // e.g., "no onions", "extra spicy"
    lineTotal: { type: Number, default: 0 },
  }],

  // Pricing
  subtotal: { type: Number, default: 0 },
  deliveryFee: { type: Number, default: 0 },
  serviceFee: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  commissionAmount: { type: Number, default: 0 }, // commission deducted by platform
  vatAmount: { type: Number, default: 0 },
  total: { type: Number, default: 0 }, // total paid by customer
  netPayout: { type: Number, default: 0 }, // what restaurant receives

  // Payment
  paymentMethod: { type: String, enum: ['cash', 'card', 'online', 'wallet', 'platform_credit'], default: 'online' },
  paymentStatus: { type: String, enum: ['paid', 'unpaid', 'refunded', 'pending'], default: 'paid' },
  paidBy: { type: String, enum: ['customer_online', 'customer_cash', 'platform'], default: 'customer_online' },

  // Order status (unified across platforms)
  status: {
    type: String,
    enum: ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'delivered', 'cancelled', 'rejected'],
    default: 'pending',
    index: true,
  },
  platformStatus: { type: String }, // raw status from platform

  // Timing
  placedAt: { type: Date, default: Date.now },
  acceptedAt: { type: Date },
  preparingAt: { type: Date },
  readyAt: { type: Date },
  pickedUpAt: { type: Date },
  deliveredAt: { type: Date },
  cancelledAt: { type: Date },
  estimatedDeliveryTime: { type: Number }, // minutes
  prepTimeMinutes: { type: Number },

  // Driver info
  driver: {
    name: { type: String },
    phone: { type: String },
    vehicleType: { type: String },
    licensePlate: { type: String },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      updatedAt: { type: Date },
    },
  },

  // Cancellation
  cancelReason: { type: String },
  cancelledBy: { type: String, enum: ['customer', 'restaurant', 'platform', 'driver'] },

  // Sync
  lastSyncedAt: { type: Date },
  syncErrors: [{ type: String }],

  // Link to restaurant order
  restaurantOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'RestaurantOrder' },

  // Payout
  payoutId: { type: String }, // platform payout reference
  payoutStatus: { type: String, enum: ['pending', 'settled', 'failed'], default: 'pending' },
  payoutDate: { type: Date },

  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

deliveryOrderSchema.index({ tenantId: 1, platform: 1, platformOrderId: 1 }, { unique: true });
deliveryOrderSchema.index({ tenantId: 1, status: 1, placedAt: -1 });
deliveryOrderSchema.index({ tenantId: 1, payoutStatus: 1 });

// Menu sync log
const menuSyncLogSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  platformConfigId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPlatformConfig', required: true },
  platform: { type: String, required: true },

  action: { type: String, enum: ['full_sync', 'price_update', 'availability_update', 'item_add', 'item_remove'], required: true },
  status: { type: String, enum: ['success', 'partial', 'failed'], default: 'success' },

  itemsSynced: { type: Number, default: 0 },
  itemsFailed: { type: Number, default: 0 },
  errors: [{ item: String, error: String }],

  duration: { type: Number }, // ms
  triggeredBy: { type: String, enum: ['manual', 'auto', 'webhook'] },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

menuSyncLogSchema.index({ tenantId: 1, platformConfigId: 1, createdAt: -1 });

export const DeliveryPlatformConfig = mongoose.models.DeliveryPlatformConfig || mongoose.model('DeliveryPlatformConfig', deliveryPlatformConfigSchema);
export const DeliveryOrder = mongoose.models.DeliveryOrder || mongoose.model('DeliveryOrder', deliveryOrderSchema);
export const MenuSyncLog = mongoose.models.MenuSyncLog || mongoose.model('MenuSyncLog', menuSyncLogSchema);
