import mongoose from 'mongoose';

// WhatsApp Configuration Schema
const whatsappConfigSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
  
  // WhatsApp Business API Configuration
  provider: { type: String, enum: ['meta', 'twilio', 'messagebird'], default: 'meta' },
  phoneNumberId: { type: String },
  businessAccountId: { type: String },
  accessToken: { type: String },
  webhookVerifyToken: { type: String },
  appSecret: { type: String, default: '' },
  graphApiVersion: { type: String, default: 'v21.0' },

  displayPhoneNumber: { type: String, default: '' },
  verifiedName: { type: String, default: '' },
  qualityRating: { type: String, default: '' },
  connectionStatus: { type: String, enum: ['disconnected', 'action_required', 'connected', 'error'], default: 'disconnected' },
  lastHealthCheckAt: { type: Date },
  lastHealthError: { type: String, default: '' },

  autoSendInvoices: { type: Boolean, default: true },
  autoNotifyOrderStatus: { type: Boolean, default: true },
  invoiceTemplateName: { type: String, default: 'maqder_invoice' },
  invoiceTemplateLanguage: { type: String, default: 'en_US' },
  invoiceTemplateNameAr: { type: String, default: 'maqder_invoice_ar' },
  invoiceTemplateLanguageAr: { type: String, default: 'ar' },
  metaAppId: { type: String, default: '' },
  
  // Display settings
  businessName: { type: String },
  businessDescription: { type: String },
  profilePictureUrl: { type: String },
  
  // Features
  autoReply: { type: Boolean, default: false },
  autoReplyMessage: { type: String, default: 'Thank you for your message. We will get back to you soon.' },
  autoReplyMessageAr: { type: String, default: 'شكراً لرسالتك. سنرد عليك قريباً.' },
  businessHoursOnly: { type: Boolean, default: false },
  businessHours: {
    sunday: { start: String, end: String, enabled: { type: Boolean, default: false } },
    monday: { start: String, end: String, enabled: { type: Boolean, default: true } },
    tuesday: { start: String, end: String, enabled: { type: Boolean, default: true } },
    wednesday: { start: String, end: String, enabled: { type: Boolean, default: true } },
    thursday: { start: String, end: String, enabled: { type: Boolean, default: true } },
    friday: { start: String, end: String, enabled: { type: Boolean, default: false } },
    saturday: { start: String, end: String, enabled: { type: Boolean, default: false } }
  },
  
  isActive: { type: Boolean, default: false },
  lastSyncedAt: { type: Date }
}, { timestamps: true });

whatsappConfigSchema.index({ phoneNumberId: 1 });
whatsappConfigSchema.index({ businessAccountId: 1 });

// WhatsApp Contact Schema
const whatsappContactSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  
  phoneNumber: { type: String, index: true },
  countryCode: { type: String, default: '+966' },
  formattedPhone: { type: String },
  
  name: { type: String },
  profileName: { type: String },
  avatarUrl: { type: String },
  
  // Link to existing records
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  
  labels: [{ type: String }],
  notes: { type: String },

  // Group fields
  isGroup: { type: Boolean, default: false },
  groupId: { type: String, index: true },
  groupDescription: { type: String },
  participantCount: { type: Number },
  groupOwner: { type: String },
  
  // Conversation stats
  lastMessageAt: { type: Date },
  unreadCount: { type: Number, default: 0 },
  totalMessages: { type: Number, default: 0 },
  
  // Sync metadata
  source: { type: String, enum: ['webhook', 'sync', 'manual'], default: 'webhook' },

  isBlocked: { type: Boolean, default: false },
  isStarred: { type: Boolean, default: false }
}, { timestamps: true });

whatsappContactSchema.index({ tenantId: 1, phoneNumber: 1 }, { unique: true, sparse: true });
whatsappContactSchema.index({ tenantId: 1, groupId: 1 }, { unique: true, sparse: true });

// WhatsApp Message Schema
const whatsappMessageSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppContact', required: true, index: true },
  
  // Message identifiers
  waMessageId: { type: String, index: true },
  conversationId: { type: String },
  
  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  
  // Message content
  type: { 
    type: String, 
    enum: ['text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'sticker', 'template', 'interactive'],
    default: 'text'
  },
  
  text: { type: String },
  caption: { type: String },
  
  // Media
  mediaUrl: { type: String },
  mediaId: { type: String },
  mimeType: { type: String },
  fileName: { type: String },
  fileSize: { type: Number },
  
  // Location
  location: {
    latitude: Number,
    longitude: Number,
    name: String,
    address: String
  },
  
  // Template
  templateName: { type: String },
  templateLanguage: { type: String },
  templateComponents: [{ type: mongoose.Schema.Types.Mixed }],
  
  // Interactive
  interactive: {
    type: { type: String },
    header: mongoose.Schema.Types.Mixed,
    body: mongoose.Schema.Types.Mixed,
    footer: mongoose.Schema.Types.Mixed,
    action: mongoose.Schema.Types.Mixed
  },
  
  // Status
  status: { 
    type: String, 
    enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
    default: 'pending'
  },
  errorCode: { type: String },
  errorMessage: { type: String },
  
  // Metadata
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isFromTemplate: { type: Boolean, default: false },
  
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

whatsappMessageSchema.index({ tenantId: 1, timestamp: -1 });
whatsappMessageSchema.index({ contactId: 1, timestamp: -1 });

// WhatsApp Template Schema
const whatsappTemplateSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  
  name: { type: String, required: true },
  language: { type: String, default: 'en' },
  category: { 
    type: String, 
    enum: ['marketing', 'utility', 'authentication'],
    default: 'utility'
  },
  
  // Template components
  header: {
    type: { type: String, enum: ['text', 'image', 'video', 'document'] },
    text: String,
    mediaUrl: String
  },
  body: { type: String, required: true },
  footer: { type: String },
  
  // Buttons
  buttons: [{
    type: { type: String, enum: ['quick_reply', 'url', 'phone'] },
    text: String,
    url: String,
    phoneNumber: String
  }],
  
  // Variables
  variables: [{
    index: Number,
    example: String,
    description: String
  }],
  
  // Meta status
  metaTemplateId: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'disabled'],
    default: 'pending'
  },
  rejectionReason: { type: String },
  
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

whatsappTemplateSchema.index({ tenantId: 1, name: 1 }, { unique: true });

// Quick Reply Schema
const quickReplySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  
  shortcut: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  messageAr: { type: String },
  
  category: { type: String },
  usageCount: { type: Number, default: 0 },
  
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

quickReplySchema.index({ tenantId: 1, shortcut: 1 }, { unique: true });

// Broadcast Schema
const broadcastSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  
  name: { type: String, required: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppTemplate' },
  
  recipients: [{
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppContact' },
    phoneNumber: String,
    status: { type: String, enum: ['pending', 'sent', 'delivered', 'read', 'failed'], default: 'pending' },
    sentAt: Date,
    errorMessage: String
  }],
  
  status: { 
    type: String, 
    enum: ['draft', 'scheduled', 'sending', 'completed', 'cancelled'],
    default: 'draft'
  },
  scheduledAt: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  
  stats: {
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export const WhatsAppConfig = mongoose.model('WhatsAppConfig', whatsappConfigSchema);
export const WhatsAppContact = mongoose.model('WhatsAppContact', whatsappContactSchema);
export const WhatsAppMessage = mongoose.model('WhatsAppMessage', whatsappMessageSchema);
export const WhatsAppTemplate = mongoose.model('WhatsAppTemplate', whatsappTemplateSchema);
export const QuickReply = mongoose.model('QuickReply', quickReplySchema);
export const Broadcast = mongoose.model('Broadcast', broadcastSchema);
