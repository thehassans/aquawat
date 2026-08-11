import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { protect, tenantFilter, requireTenantFilter, checkPermission } from '../middleware/auth.js';
import multer from 'multer';
import { 
  WhatsAppConfig, 
  WhatsAppContact, 
  WhatsAppMessage, 
  WhatsAppTemplate,
  QuickReply,
  Broadcast
} from '../models/WhatsApp.js';
import whatsappService from '../services/whatsappService.js';
import { verifyMetaHubSignature } from '../utils/webhookAuth.js';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(String(file?.mimetype || '').toLowerCase());
    cb(ok ? null : new Error('Only PDF or image uploads are allowed'), ok);
  },
});

const router = express.Router();

// Meta WhatsApp API base URL
const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

// Helper: Get WhatsApp config for tenant
async function getConfig(tenantId) {
  return await WhatsAppConfig.findOne({ tenantId, isActive: true });
}

// Helper: Send WhatsApp message via Meta API
async function sendWhatsAppMessage(config, to, messageData) {
  const url = `${WHATSAPP_API_URL}/${config.phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to.replace(/\D/g, ''),
    ...messageData
  };

  const response = await axios.post(url, payload, {
    headers: {
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}

// ============== WEBHOOK ROUTES (No Auth) ==============

// Webhook verification (GET)
router.get('/webhook', async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Find config with matching verify token
  const config = await WhatsAppConfig.findOne({ webhookVerifyToken: token });

  if (mode === 'subscribe' && config) {
    console.log('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Webhook for incoming messages (POST)
router.post('/webhook', async (req, res) => {
  try {
    const appSecret = process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET || '';
    if (!appSecret) {
      console.error('WhatsApp webhook rejected: WHATSAPP_APP_SECRET not configured');
      return res.sendStatus(503);
    }
    if (!verifyMetaHubSignature(req, appSecret)) {
      return res.sendStatus(401);
    }

    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            const value = change.value;
            const phoneNumberId = value.metadata?.phone_number_id;
            
            // Find tenant config
            const config = await WhatsAppConfig.findOne({ phoneNumberId });
            if (!config) continue;

            // Process messages
            for (const message of value.messages || []) {
              await processIncomingMessage(config.tenantId, message, value.contacts?.[0]);
            }

            // Process status updates
            for (const status of value.statuses || []) {
              await processStatusUpdate(config.tenantId, status);
            }
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

// Process incoming message
async function processIncomingMessage(tenantId, message, contactInfo) {
  const phoneNumber = message.from;
  
  // Find or create contact
  let contact = await WhatsAppContact.findOne({ tenantId, phoneNumber });
  if (!contact) {
    contact = await WhatsAppContact.create({
      tenantId,
      phoneNumber,
      formattedPhone: `+${phoneNumber}`,
      name: contactInfo?.profile?.name || phoneNumber,
      profileName: contactInfo?.profile?.name
    });
  }

  // Determine message type and content
  let messageData = {
    tenantId,
    contactId: contact._id,
    waMessageId: message.id,
    direction: 'inbound',
    type: message.type,
    timestamp: new Date(parseInt(message.timestamp) * 1000),
    status: 'delivered'
  };

  switch (message.type) {
    case 'text':
      messageData.text = message.text?.body;
      break;
    case 'image':
    case 'video':
    case 'audio':
    case 'document':
    case 'sticker':
      messageData.mediaId = message[message.type]?.id;
      messageData.mimeType = message[message.type]?.mime_type;
      messageData.caption = message[message.type]?.caption;
      messageData.fileName = message[message.type]?.filename;
      break;
    case 'location':
      messageData.location = {
        latitude: message.location?.latitude,
        longitude: message.location?.longitude,
        name: message.location?.name,
        address: message.location?.address
      };
      break;
    case 'interactive':
      messageData.interactive = message.interactive;
      messageData.text = message.interactive?.button_reply?.title || 
                         message.interactive?.list_reply?.title;
      break;
  }

  await WhatsAppMessage.create(messageData);

  // Update contact
  await WhatsAppContact.findByIdAndUpdate(contact._id, {
    lastMessageAt: new Date(),
    $inc: { unreadCount: 1, totalMessages: 1 }
  });

  // Check for auto-reply
  const config = await WhatsAppConfig.findOne({ tenantId });
  if (config?.autoReply) {
    // Check business hours if enabled
    if (config.businessHoursOnly) {
      const now = new Date();
      const day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
      const hours = config.businessHours?.[day];
      
      if (!hours?.enabled) {
        await sendWhatsAppMessage(config, phoneNumber, {
          type: 'text',
          text: { body: config.autoReplyMessage }
        });
      }
    }
  }
}

// Process status update
async function processStatusUpdate(tenantId, status) {
  const statusMap = {
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    failed: 'failed'
  };

  await WhatsAppMessage.findOneAndUpdate(
    { tenantId, waMessageId: status.id },
    { 
      status: statusMap[status.status] || status.status,
      ...(status.errors && {
        errorCode: status.errors[0]?.code,
        errorMessage: status.errors[0]?.message
      })
    }
  );
}

// ============== PROTECTED ROUTES ==============

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

// ============== UNOFFICIAL API ROUTES ==============

router.get('/client/status', async (req, res) => {
  try {
    const status = whatsappService.getStatus(req.user.tenantId);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/client/init', async (req, res) => {
  try {
    const status = await whatsappService.initClient(req.user.tenantId);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/client/logout', async (req, res) => {
  try {
    await whatsappService.logout(req.user.tenantId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sync contacts from WhatsApp client
router.post('/client/sync-contacts', async (req, res) => {
  try {
    const result = await whatsappService.syncContacts(req.user.tenantId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/client/send-pdf', upload.single('pdf'), async (req, res) => {
  try {
    const { phoneNumber, fileName, caption } = req.body;
    if (!req.file || !phoneNumber) {
      return res.status(400).json({ error: 'Phone number and PDF file are required' });
    }

    let cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.startsWith('05') && cleanPhone.length === 10) {
      cleanPhone = '966' + cleanPhone.substring(1);
    }

    const response = await whatsappService.sendPdf(
      req.user.tenantId,
      cleanPhone,
      req.file.buffer,
      fileName || 'Invoice.pdf',
      caption || 'Here is your invoice.'
    );

    let contact = await WhatsAppContact.findOne({ tenantId: req.user.tenantId, phoneNumber: cleanPhone });
    if (!contact) {
      contact = await WhatsAppContact.create({
        tenantId: req.user.tenantId,
        phoneNumber: cleanPhone,
        formattedPhone: `+${cleanPhone}`,
        name: `+${cleanPhone}`
      });
    }

    await WhatsAppMessage.create({
      tenantId: req.user.tenantId,
      contactId: contact._id,
      waMessageId: response?.id?._serialized || Date.now().toString(),
      direction: 'outbound',
      type: 'document',
      caption: caption || 'Here is your invoice.',
      fileName: fileName || 'Invoice.pdf',
      status: 'sent',
      sentBy: req.user._id,
      timestamp: new Date()
    });

    await WhatsAppContact.findByIdAndUpdate(contact._id, {
      lastMessageAt: new Date(),
      $inc: { totalMessages: 1 }
    });

    res.json({ success: true, messageId: response?.id?._serialized });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get WhatsApp config
router.get('/config', checkPermission('settings', 'read'), async (req, res) => {
  try {
    let config = await WhatsAppConfig.findOne({ tenantId: req.user.tenantId });
    
    if (!config) {
      config = await WhatsAppConfig.create({ tenantId: req.user.tenantId });
    }

    // Mask sensitive data
    const maskedConfig = config.toObject();
    if (maskedConfig.accessToken) {
      maskedConfig.accessToken = '••••••••' + maskedConfig.accessToken.slice(-8);
    }

    res.json(maskedConfig);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update WhatsApp config
router.put('/config', checkPermission('settings', 'update'), async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    // Generate webhook verify token if not provided
    if (!updateData.webhookVerifyToken) {
      updateData.webhookVerifyToken = crypto.randomBytes(32).toString('hex');
    }

    const config = await WhatsAppConfig.findOneAndUpdate(
      { tenantId: req.user.tenantId },
      updateData,
      { new: true, upsert: true, runValidators: true }
    );

    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test WhatsApp connection
router.post('/config/test', checkPermission('settings', 'update'), async (req, res) => {
  try {
    const config = await WhatsAppConfig.findOne({ tenantId: req.user.tenantId });
    
    if (!config?.accessToken || !config?.phoneNumberId) {
      return res.status(400).json({ error: 'WhatsApp not configured' });
    }

    // Test API connection
    const response = await axios.get(
      `${WHATSAPP_API_URL}/${config.phoneNumberId}`,
      { headers: { 'Authorization': `Bearer ${config.accessToken}` } }
    );

    res.json({ success: true, phoneNumber: response.data.display_phone_number });
  } catch (error) {
    res.status(400).json({ error: error.response?.data?.error?.message || error.message });
  }
});

// ============== CONTACTS ROUTES ==============

// Get all contacts
router.get('/contacts', async (req, res) => {
  try {
    const { search, label, starred, page = 1, limit = 50 } = req.query;
    
    const query = { ...req.tenantFilter, isBlocked: false };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { profileName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (label) query.labels = label;
    if (starred === 'true') query.isStarred = true;

    const contacts = await WhatsAppContact.find(query)
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await WhatsAppContact.countDocuments(query);

    res.json({ contacts, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export contacts (individuals + groups) as CSV/JSON
router.get('/contacts/export', async (req, res) => {
  try {
    const { format = 'csv', type = 'all' } = req.query;
    const query = { ...req.tenantFilter };
    if (type === 'individuals') query.isGroup = false;
    if (type === 'groups') query.isGroup = true;

    const contacts = await WhatsAppContact.find(query).sort({ name: 1 }).lean();

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="whatsapp-contacts.json"');
      return res.json(contacts);
    }

    // CSV export
    const headers = ['Name', 'Phone Number', 'Profile Name', 'Type', 'Group ID', 'Participants', 'Labels', 'Notes', 'Last Message', 'Created At'];
    const rows = contacts.map(c => [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.formattedPhone || c.phoneNumber || '').replace(/"/g, '""')}"`,
      `"${(c.profileName || '').replace(/"/g, '""')}"`,
      c.isGroup ? 'Group' : 'Individual',
      `"${(c.groupId || '').replace(/"/g, '""')}"`,
      c.participantCount || '',
      `"${(c.labels || []).join(', ').replace(/"/g, '""')}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
      c.lastMessageAt ? new Date(c.lastMessageAt).toISOString() : '',
      c.createdAt ? new Date(c.createdAt).toISOString() : ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="whatsapp-contacts.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single contact with messages
router.get('/contacts/:id', async (req, res) => {
  try {
    const contact = await WhatsAppContact.findOne({ 
      _id: req.params.id, 
      ...req.tenantFilter 
    });
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Mark as read
    await WhatsAppContact.findByIdAndUpdate(contact._id, { unreadCount: 0 });

    // Get messages
    const messages = await WhatsAppMessage.find({ contactId: contact._id })
      .sort({ timestamp: 1 })
      .limit(100)
      .populate('sentBy', 'firstName lastName');

    res.json({ contact, messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create/update contact
router.post('/contacts', async (req, res) => {
  try {
    const { phoneNumber, ...data } = req.body;
    
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    const contact = await WhatsAppContact.findOneAndUpdate(
      { tenantId: req.user.tenantId, phoneNumber: cleanPhone },
      { 
        ...data, 
        phoneNumber: cleanPhone,
        formattedPhone,
        tenantId: req.user.tenantId 
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update contact
router.put('/contacts/:id', async (req, res) => {
  try {
    const contact = await WhatsAppContact.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle star
router.post('/contacts/:id/star', async (req, res) => {
  try {
    const contact = await WhatsAppContact.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    contact.isStarred = !contact.isStarred;
    await contact.save();

    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Block/unblock contact
router.post('/contacts/:id/block', async (req, res) => {
  try {
    const contact = await WhatsAppContact.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    contact.isBlocked = !contact.isBlocked;
    await contact.save();

    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============== MESSAGES ROUTES ==============

// Send text message
router.post('/messages/send', async (req, res) => {
  try {
    const { contactId, phoneNumber, text, type = 'text' } = req.body;
    
    const config = await getConfig(req.user.tenantId);
    if (!config) {
      return res.status(400).json({ error: 'WhatsApp not configured or inactive' });
    }

    // Get or create contact
    let contact;
    if (contactId) {
      contact = await WhatsAppContact.findOne({ _id: contactId, ...req.tenantFilter });
    } else if (phoneNumber) {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      contact = await WhatsAppContact.findOneAndUpdate(
        { tenantId: req.user.tenantId, phoneNumber: cleanPhone },
        { 
          tenantId: req.user.tenantId,
          phoneNumber: cleanPhone,
          formattedPhone: `+${cleanPhone}`
        },
        { new: true, upsert: true }
      );
    }

    if (!contact) {
      return res.status(400).json({ error: 'Contact not found' });
    }

    // Send message via API
    const apiResponse = await sendWhatsAppMessage(config, contact.phoneNumber, {
      type: 'text',
      text: { body: text }
    });

    // Save message
    const message = await WhatsAppMessage.create({
      tenantId: req.user.tenantId,
      contactId: contact._id,
      waMessageId: apiResponse.messages?.[0]?.id,
      direction: 'outbound',
      type: 'text',
      text,
      status: 'sent',
      sentBy: req.user._id,
      timestamp: new Date()
    });

    // Update contact
    await WhatsAppContact.findByIdAndUpdate(contact._id, {
      lastMessageAt: new Date(),
      $inc: { totalMessages: 1 }
    });

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

// Send template message
router.post('/messages/send-template', async (req, res) => {
  try {
    const { contactId, templateId, variables = [] } = req.body;
    
    const config = await getConfig(req.user.tenantId);
    if (!config) {
      return res.status(400).json({ error: 'WhatsApp not configured' });
    }

    const contact = await WhatsAppContact.findOne({ _id: contactId, ...req.tenantFilter });
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const template = await WhatsAppTemplate.findOne({ _id: templateId, ...req.tenantFilter });
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Build template components
    const components = [];
    if (variables.length > 0) {
      components.push({
        type: 'body',
        parameters: variables.map(v => ({ type: 'text', text: v }))
      });
    }

    // Send via API
    const apiResponse = await sendWhatsAppMessage(config, contact.phoneNumber, {
      type: 'template',
      template: {
        name: template.name,
        language: { code: template.language },
        components
      }
    });

    // Save message
    const message = await WhatsAppMessage.create({
      tenantId: req.user.tenantId,
      contactId: contact._id,
      waMessageId: apiResponse.messages?.[0]?.id,
      direction: 'outbound',
      type: 'template',
      templateName: template.name,
      templateLanguage: template.language,
      templateComponents: components,
      text: template.body,
      status: 'sent',
      sentBy: req.user._id,
      isFromTemplate: true,
      timestamp: new Date()
    });

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

// Get conversation messages
router.get('/messages/:contactId', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const messages = await WhatsAppMessage.find({ 
      contactId: req.params.contactId,
      ...req.tenantFilter 
    })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('sentBy', 'firstName lastName');

    // Mark contact as read — always scope by tenant to prevent IDOR
    await WhatsAppContact.findOneAndUpdate(
      { _id: req.params.contactId, ...req.tenantFilter },
      { unreadCount: 0 }
    );

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============== TEMPLATES ROUTES ==============

// Get templates
router.get('/templates', async (req, res) => {
  try {
    const templates = await WhatsAppTemplate.find({ ...req.tenantFilter, isActive: true })
      .sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create template
router.post('/templates', checkPermission('settings', 'create'), async (req, res) => {
  try {
    const template = await WhatsAppTemplate.create({
      ...req.body,
      tenantId: req.user.tenantId
    });
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update template
router.put('/templates/:id', checkPermission('settings', 'update'), async (req, res) => {
  try {
    const template = await WhatsAppTemplate.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete template
router.delete('/templates/:id', checkPermission('settings', 'delete'), async (req, res) => {
  try {
    await WhatsAppTemplate.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false }
    );
    res.json({ message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sync templates from Meta
router.post('/templates/sync', checkPermission('settings', 'update'), async (req, res) => {
  try {
    const config = await getConfig(req.user.tenantId);
    if (!config) {
      return res.status(400).json({ error: 'WhatsApp not configured' });
    }

    const response = await axios.get(
      `${WHATSAPP_API_URL}/${config.businessAccountId}/message_templates`,
      { headers: { 'Authorization': `Bearer ${config.accessToken}` } }
    );

    const templates = response.data.data || [];
    
    for (const t of templates) {
      await WhatsAppTemplate.findOneAndUpdate(
        { tenantId: req.user.tenantId, name: t.name },
        {
          tenantId: req.user.tenantId,
          name: t.name,
          language: t.language,
          category: t.category?.toLowerCase(),
          metaTemplateId: t.id,
          status: t.status?.toLowerCase(),
          body: t.components?.find(c => c.type === 'BODY')?.text || '',
          header: t.components?.find(c => c.type === 'HEADER'),
          footer: t.components?.find(c => c.type === 'FOOTER')?.text
        },
        { upsert: true }
      );
    }

    res.json({ synced: templates.length });
  } catch (error) {
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

// ============== QUICK REPLIES ROUTES ==============

// Get quick replies
router.get('/quick-replies', async (req, res) => {
  try {
    const replies = await QuickReply.find({ ...req.tenantFilter, isActive: true })
      .sort({ usageCount: -1 });
    res.json(replies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create quick reply
router.post('/quick-replies', async (req, res) => {
  try {
    const reply = await QuickReply.create({
      ...req.body,
      tenantId: req.user.tenantId
    });
    res.status(201).json(reply);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update quick reply
router.put('/quick-replies/:id', async (req, res) => {
  try {
    const reply = await QuickReply.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      req.body,
      { new: true, runValidators: true }
    );
    res.json(reply);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete quick reply
router.delete('/quick-replies/:id', async (req, res) => {
  try {
    await QuickReply.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false }
    );
    res.json({ message: 'Quick reply deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============== BROADCASTS ROUTES ==============

// Get broadcasts
router.get('/broadcasts', async (req, res) => {
  try {
    const broadcasts = await Broadcast.find(req.tenantFilter)
      .sort({ createdAt: -1 })
      .populate('templateId', 'name')
      .populate('createdBy', 'firstName lastName');
    res.json(broadcasts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create broadcast
router.post('/broadcasts', async (req, res) => {
  try {
    const { name, templateId, contactIds, scheduledAt } = req.body;

    const contacts = await WhatsAppContact.find({
      _id: { $in: contactIds },
      ...req.tenantFilter
    });

    const broadcast = await Broadcast.create({
      tenantId: req.user.tenantId,
      name,
      templateId,
      recipients: contacts.map(c => ({
        contactId: c._id,
        phoneNumber: c.phoneNumber,
        status: 'pending'
      })),
      status: scheduledAt ? 'scheduled' : 'draft',
      scheduledAt,
      stats: { total: contacts.length },
      createdBy: req.user._id
    });

    res.status(201).json(broadcast);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send broadcast now
router.post('/broadcasts/:id/send', async (req, res) => {
  try {
    const broadcast = await Broadcast.findOne({ _id: req.params.id, ...req.tenantFilter })
      .populate('templateId');
    
    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const config = await getConfig(req.user.tenantId);
    if (!config) {
      return res.status(400).json({ error: 'WhatsApp not configured' });
    }

    broadcast.status = 'sending';
    broadcast.startedAt = new Date();
    await broadcast.save();

    // Send messages (async, don't wait)
    (async () => {
      for (const recipient of broadcast.recipients) {
        try {
          await sendWhatsAppMessage(config, recipient.phoneNumber, {
            type: 'template',
            template: {
              name: broadcast.templateId.name,
              language: { code: broadcast.templateId.language }
            }
          });
          
          recipient.status = 'sent';
          recipient.sentAt = new Date();
          broadcast.stats.sent++;
        } catch (error) {
          recipient.status = 'failed';
          recipient.errorMessage = error.message;
          broadcast.stats.failed++;
        }
        await broadcast.save();
      }
      
      broadcast.status = 'completed';
      broadcast.completedAt = new Date();
      await broadcast.save();
    })();

    res.json({ message: 'Broadcast started', broadcast });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============== ANALYTICS ROUTES ==============

// Get WhatsApp stats
router.get('/stats', async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [contacts, groups, messages, unread] = await Promise.all([
      WhatsAppContact.countDocuments({ ...req.tenantFilter, isGroup: false }),
      WhatsAppContact.countDocuments({ ...req.tenantFilter, isGroup: true }),
      WhatsAppMessage.countDocuments({ ...req.tenantFilter, timestamp: { $gte: startDate } }),
      WhatsAppContact.aggregate([
        { $match: req.tenantFilter },
        { $group: { _id: null, total: { $sum: '$unreadCount' } } }
      ])
    ]);

    const messagesByDay = await WhatsAppMessage.aggregate([
      {
        $match: {
          ...req.tenantFilter,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            direction: '$direction'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    res.json({
      totalContacts: contacts,
      totalGroups: groups,
      totalMessages: messages,
      unreadMessages: unread[0]?.total || 0,
      messagesByDay
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
