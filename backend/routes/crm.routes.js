import express from 'express';
import CRMLead from '../models/CRMLead.js';
import CRMDeal from '../models/CRMDeal.js';
import CRMActivity from '../models/CRMActivity.js';
import CRMContact from '../models/CRMContact.js';
import CRMCampaign from '../models/CRMCampaign.js';
import Customer from '../models/Customer.js';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import { protect, tenantFilter, checkPermission } from '../middleware/auth.js';
import whatsappService from '../services/whatsappService.js';
import { sendTenantEmail } from '../utils/tenantEmailService.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);

function cleanBody(body) {
  const cleaned = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === '') {
      cleaned[key] = null;
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/* ─── Business Logic Helpers ─── */
const LEAD_VALID_TRANSITIONS = {
  new: ['contacted', 'qualified', 'lost'],
  contacted: ['qualified', 'proposal_sent', 'lost'],
  qualified: ['proposal_sent', 'negotiation', 'lost'],
  proposal_sent: ['negotiation', 'converted', 'lost'],
  negotiation: ['converted', 'lost'],
  converted: [],
  lost: ['new', 'contacted'],
};

const DEAL_STAGE_PROBABILITY = {
  prospecting: 10,
  qualification: 25,
  proposal: 50,
  negotiation: 75,
  closed_won: 100,
  closed_lost: 0,
};

function canTransitionLead(from, to) {
  return LEAD_VALID_TRANSITIONS[from]?.includes(to) || false;
}

function getDealProbability(stage) {
  return DEAL_STAGE_PROBABILITY[stage] ?? 10;
}

/* ─────────── LEADS ─────────── */

router.get('/leads', checkPermission('crm', 'read'), async (req, res) => {
  try {
    const { search, status, assignedTo, page = 1, limit = 50 } = req.query;
    const filter = { ...req.tenantFilter };
    if (status) filter.status = status;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (Math.max(1, Number(page)) - 1) * Math.min(200, Math.max(1, Number(limit)));
    const parsedLimit = Math.min(200, Math.max(1, Number(limit)));
    const [leads, total] = await Promise.all([
      CRMLead.find(filter).sort('-createdAt').skip(skip).limit(parsedLimit).populate('assignedTo', 'name').populate('customerId', 'name').lean(),
      CRMLead.countDocuments(filter),
    ]);
    res.json({ leads, pagination: { page: Number(page), limit: parsedLimit, total, pages: Math.ceil(total / parsedLimit) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/leads/:id', checkPermission('crm', 'read'), async (req, res) => {
  try {
    const lead = await CRMLead.findOne({ _id: req.params.id, ...req.tenantFilter }).populate('assignedTo', 'name').populate('customerId', 'name').lean();
    if (!lead) return res.status(404).json({ error: 'Not found' });
    res.json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/leads', checkPermission('crm', 'create'), async (req, res) => {
  try {
    const lead = await CRMLead.create({ ...cleanBody(req.body), tenantId: req.user.tenantId, createdBy: req.user._id });
    res.status(201).json(lead);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/leads/:id', checkPermission('crm', 'update'), async (req, res) => {
  try {
    const lead = await CRMLead.findOneAndUpdate({ _id: req.params.id, ...req.tenantFilter }, cleanBody(req.body), { new: true, runValidators: true });
    if (!lead) return res.status(404).json({ error: 'Not found' });
    res.json(lead);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/leads/:id', checkPermission('crm', 'delete'), async (req, res) => {
  try {
    const lead = await CRMLead.findOneAndDelete({ _id: req.params.id, ...req.tenantFilter });
    if (!lead) return res.status(404).json({ error: 'Not found' });
    await CRMActivity.deleteMany({ leadId: req.params.id, ...req.tenantFilter });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ─────────── DEALS ─────────── */

router.get('/deals', checkPermission('crm', 'read'), async (req, res) => {
  try {
    const { search, stage, assignedTo, page = 1, limit = 50 } = req.query;
    const filter = { ...req.tenantFilter };
    if (stage) filter.stage = stage;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (search) filter.title = { $regex: search, $options: 'i' };
    const skip = (Math.max(1, Number(page)) - 1) * Math.min(200, Math.max(1, Number(limit)));
    const parsedLimit = Math.min(200, Math.max(1, Number(limit)));
    const [deals, total] = await Promise.all([
      CRMDeal.find(filter).sort('-updatedAt').skip(skip).limit(parsedLimit).populate('assignedTo', 'name').populate('leadId', 'name').populate('customerId', 'name').lean(),
      CRMDeal.countDocuments(filter),
    ]);
    res.json({ deals, pagination: { page: Number(page), limit: parsedLimit, total, pages: Math.ceil(total / parsedLimit) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/deals/:id', checkPermission('crm', 'read'), async (req, res) => {
  try {
    const deal = await CRMDeal.findOne({ _id: req.params.id, ...req.tenantFilter }).populate('assignedTo', 'name').populate('leadId', 'name').populate('customerId', 'name').lean();
    if (!deal) return res.status(404).json({ error: 'Not found' });
    res.json(deal);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/deals', checkPermission('crm', 'create'), async (req, res) => {
  try {
    const deal = await CRMDeal.create({ ...cleanBody(req.body), tenantId: req.user.tenantId, createdBy: req.user._id });
    res.status(201).json(deal);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/deals/:id', checkPermission('crm', 'delete'), async (req, res) => {
  try {
    const deal = await CRMDeal.findOneAndDelete({ _id: req.params.id, ...req.tenantFilter });
    if (!deal) return res.status(404).json({ error: 'Not found' });
    await CRMActivity.deleteMany({ dealId: req.params.id, ...req.tenantFilter });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ─────────── ACTIVITIES ─────────── */

router.get('/activities', checkPermission('crm', 'read'), async (req, res) => {
  try {
    const { leadId, dealId, customerId, type, page = 1, limit = 50 } = req.query;
    const filter = { ...req.tenantFilter };
    if (leadId) filter.leadId = leadId;
    if (dealId) filter.dealId = dealId;
    if (customerId) filter.customerId = customerId;
    if (type) filter.type = type;
    const skip = (Math.max(1, Number(page)) - 1) * Math.min(200, Math.max(1, Number(limit)));
    const parsedLimit = Math.min(200, Math.max(1, Number(limit)));
    const [activities, total] = await Promise.all([
      CRMActivity.find(filter).sort('-createdAt').skip(skip).limit(parsedLimit).populate('createdBy', 'name').lean(),
      CRMActivity.countDocuments(filter),
    ]);
    res.json({ activities, pagination: { page: Number(page), limit: parsedLimit, total, pages: Math.ceil(total / parsedLimit) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/activities', checkPermission('crm', 'create'), async (req, res) => {
  try {
    const activity = await CRMActivity.create({ ...cleanBody(req.body), tenantId: req.user.tenantId, createdBy: req.user._id });
    res.status(201).json(activity);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/activities/:id', checkPermission('crm', 'update'), async (req, res) => {
  try {
    const activity = await CRMActivity.findOneAndUpdate({ _id: req.params.id, ...req.tenantFilter }, cleanBody(req.body), { new: true, runValidators: true });
    if (!activity) return res.status(404).json({ error: 'Not found' });
    res.json(activity);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/activities/:id', checkPermission('crm', 'delete'), async (req, res) => {
  try {
    const activity = await CRMActivity.findOneAndDelete({ _id: req.params.id, ...req.tenantFilter });
    if (!activity) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ─────────── LEAD STATUS TRANSITION ─────────── */

router.post('/leads/:id/transition', checkPermission('crm', 'update'), async (req, res) => {
  try {
    const { status: nextStatus } = req.body;
    const lead = await CRMLead.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!lead) return res.status(404).json({ error: 'Not found' });
    if (!canTransitionLead(lead.status, nextStatus)) {
      return res.status(400).json({ error: `Invalid transition from ${lead.status} to ${nextStatus}` });
    }
    lead.status = nextStatus;
    await lead.save();
    // Log the transition as an activity
    await CRMActivity.create({
      tenantId: req.user.tenantId,
      type: 'note',
      subject: `Lead status changed to ${nextStatus}`,
      leadId: lead._id,
      createdBy: req.user._id,
    });
    res.json(lead);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/* ─────────── LEAD TO DEAL CONVERSION ─────────── */

router.post('/leads/:id/convert', checkPermission('crm', 'create'), async (req, res) => {
  try {
    const lead = await CRMLead.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (lead.status === 'converted') return res.status(400).json({ error: 'Lead already converted' });

    let customerId = lead.customerId;
    
    // Create a real Customer if it doesn't exist
    if (!customerId) {
      const customer = await Customer.create({
        tenantId: req.user.tenantId,
        type: 'individual',
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        notes: lead.notes,
      });
      customerId = customer._id;
      lead.customerId = customerId;
    }

    // Create a CRMContact
    const contact = await CRMContact.create({
      tenantId: req.user.tenantId,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      source: lead.source,
      leadId: lead._id,
      customerId: customerId,
      assignedTo: lead.assignedTo || req.user._id,
      notes: lead.notes,
    });

    const deal = await CRMDeal.create({
      tenantId: req.user.tenantId,
      leadId: lead._id,
      customerId: customerId,
      title: req.body.title || `Deal from ${lead.name}`,
      description: req.body.description || lead.notes,
      stage: 'prospecting',
      value: lead.estimatedValue || 0,
      probability: 10,
      assignedTo: lead.assignedTo || req.user._id,
      createdBy: req.user._id,
    });

    lead.status = 'converted';
    await lead.save();

    await CRMActivity.create({
      tenantId: req.user.tenantId,
      type: 'note',
      subject: 'Lead converted to deal',
      description: `Converted to deal: ${deal.title}`,
      leadId: lead._id,
      dealId: deal._id,
      createdBy: req.user._id,
    });

    res.status(201).json({ deal, lead });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/* ─────────── DEAL PROBABILITY AUTO-UPDATE ─────────── */

router.put('/deals/:id', checkPermission('crm', 'update'), async (req, res) => {
  try {
    const updates = cleanBody(req.body);
    if (updates.stage) {
      updates.probability = getDealProbability(updates.stage);
    }
    if (updates.stage === 'closed_won' || updates.stage === 'closed_lost') {
      updates.actualCloseDate = new Date();
    }
    const deal = await CRMDeal.findOneAndUpdate({ _id: req.params.id, ...req.tenantFilter }, updates, { new: true, runValidators: true });
    if (!deal) return res.status(404).json({ error: 'Not found' });
    res.json(deal);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/* ─────────── ACTIVITY TIMELINE ─────────── */

router.get('/leads/:id/activities', checkPermission('crm', 'read'), async (req, res) => {
  try {
    const items = await CRMActivity.find({ leadId: req.params.id, ...req.tenantFilter }).sort('-createdAt').populate('createdBy', 'name').lean();
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/deals/:id/activities', checkPermission('crm', 'read'), async (req, res) => {
  try {
    const items = await CRMActivity.find({ dealId: req.params.id, ...req.tenantFilter }).sort('-createdAt').populate('createdBy', 'name').lean();
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ─────────── ASSIGNED USERS ─────────── */

router.get('/users', checkPermission('crm', 'read'), async (req, res) => {
  try {
    const users = await User.find({ ...req.tenantFilter }).select('_id name email').limit(100).lean();
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ─────────── FOLLOW-UPS DUE ─────────── */

router.get('/follow-ups', checkPermission('crm', 'read'), async (req, res) => {
  try {
    const items = await CRMActivity.find({
      ...req.tenantFilter,
      dueDate: { $lte: new Date() },
      completedAt: { $exists: false },
    }).sort('dueDate').populate('leadId', 'name').populate('dealId', 'title').populate('createdBy', 'name').lean();
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ─────────── STATS / PIPELINE ─────────── */

router.get('/stats', checkPermission('crm', 'read'), async (req, res) => {
  try {
    const [leadTotal, dealTotal, activityTotal, pipeline, leadStatus, followUpCount] = await Promise.all([
      CRMLead.countDocuments({ ...req.tenantFilter }),
      CRMDeal.countDocuments({ ...req.tenantFilter }),
      CRMActivity.countDocuments({ ...req.tenantFilter }),
      CRMDeal.aggregate([
        { $match: { ...req.tenantFilter } },
        { $group: { _id: '$stage', count: { $sum: 1 }, value: { $sum: '$value' } } },
      ]),
      CRMLead.aggregate([
        { $match: { ...req.tenantFilter } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      CRMActivity.countDocuments({ ...req.tenantFilter, dueDate: { $lte: new Date() }, completedAt: { $exists: false } }),
    ]);
    const dealValue = pipeline.reduce((s, p) => s + (p.value || 0), 0);
    const wonValue = pipeline.filter(p => p._id === 'closed_won').reduce((s, p) => s + (p.value || 0), 0);
    res.json({ leadTotal, dealTotal, activityTotal, pipeline, leadStatus, dealValue, wonValue, followUpCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ─────────── CRM COMMUNICATION ─────────── */

router.post('/leads/:id/send-whatsapp', checkPermission('crm', 'update'), async (req, res) => {
  try {
    const { message } = req.body;
    const lead = await CRMLead.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!lead) return res.status(404).json({ error: 'Not found' });
    if (!lead.phone) return res.status(400).json({ error: 'Lead has no phone number' });

    const waState = whatsappService.getStatus(String(req.user.tenantId));
    if (!waState || waState.status !== 'READY') {
      return res.status(503).json({ error: 'WhatsApp is not connected. Please connect WhatsApp first.' });
    }

    await whatsappService.sendText(String(req.user.tenantId), lead.phone, message);
    await CRMActivity.create({
      tenantId: req.user.tenantId,
      type: 'whatsapp',
      subject: 'WhatsApp sent',
      description: message,
      leadId: lead._id,
      createdBy: req.user._id,
    });
    res.json({ success: true, sentTo: lead.phone });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/leads/:id/send-email', checkPermission('crm', 'update'), async (req, res) => {
  try {
    const { subject, body } = req.body;
    const lead = await CRMLead.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!lead) return res.status(404).json({ error: 'Not found' });
    if (!lead.email) return res.status(400).json({ error: 'Lead has no email' });

    const tenant = await Tenant.findById(req.user.tenantId);
    await sendTenantEmail({
      tenant,
      to: [lead.email],
      subject,
      html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
      text: body,
      metadata: { module: 'crm', leadId: lead._id.toString(), sentBy: req.user._id.toString() },
    });
    await CRMActivity.create({
      tenantId: req.user.tenantId,
      type: 'email',
      subject: `Email: ${subject}`,
      description: body,
      leadId: lead._id,
      createdBy: req.user._id,
    });
    res.json({ success: true, sentTo: lead.email });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/deals/:id/send-whatsapp', checkPermission('crm', 'update'), async (req, res) => {
  try {
    const { message } = req.body;
    const deal = await CRMDeal.findOne({ _id: req.params.id, ...req.tenantFilter }).populate('leadId', 'phone');
    if (!deal) return res.status(404).json({ error: 'Not found' });
    const phone = deal.leadId?.phone;
    if (!phone) return res.status(400).json({ error: 'No phone number available for this deal' });

    const waState = whatsappService.getStatus(String(req.user.tenantId));
    if (!waState || waState.status !== 'READY') {
      return res.status(503).json({ error: 'WhatsApp is not connected' });
    }

    await whatsappService.sendText(String(req.user.tenantId), phone, message);
    await CRMActivity.create({
      tenantId: req.user.tenantId,
      type: 'whatsapp',
      subject: 'WhatsApp sent',
      description: message,
      dealId: deal._id,
      createdBy: req.user._id,
    });
    res.json({ success: true, sentTo: phone });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/deals/:id/send-email', checkPermission('crm', 'update'), async (req, res) => {
  try {
    const { subject, body } = req.body;
    const deal = await CRMDeal.findOne({ _id: req.params.id, ...req.tenantFilter }).populate('leadId', 'email');
    if (!deal) return res.status(404).json({ error: 'Not found' });
    const email = deal.leadId?.email;
    if (!email) return res.status(400).json({ error: 'No email available for this deal' });

    const tenant = await Tenant.findById(req.user.tenantId);
    await sendTenantEmail({
      tenant,
      to: [email],
      subject,
      html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
      text: body,
      metadata: { module: 'crm', dealId: deal._id.toString(), sentBy: req.user._id.toString() },
    });
    await CRMActivity.create({
      tenantId: req.user.tenantId,
      type: 'email',
      subject: `Email: ${subject}`,
      description: body,
      dealId: deal._id,
      createdBy: req.user._id,
    });
    res.json({ success: true, sentTo: email });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ─────────── CONTACTS ─────────── */

router.get('/contacts', checkPermission('crm', 'read'), async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const filter = { ...req.tenantFilter };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (Math.max(1, Number(page)) - 1) * Math.min(200, Math.max(1, Number(limit)));
    const parsedLimit = Math.min(200, Math.max(1, Number(limit)));
    const [contacts, total] = await Promise.all([
      CRMContact.find(filter).sort('-createdAt').skip(skip).limit(parsedLimit).populate('assignedTo', 'name').populate('customerId', 'name').lean(),
      CRMContact.countDocuments(filter),
    ]);
    res.json({ contacts, pagination: { page: Number(page), limit: parsedLimit, total, pages: Math.ceil(total / parsedLimit) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/contacts', checkPermission('crm', 'create'), async (req, res) => {
  try {
    let customerId = req.body.customerId;
    if (!customerId) {
      const customer = await Customer.create({
        tenantId: req.user.tenantId,
        type: 'individual',
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        notes: req.body.notes,
      });
      customerId = customer._id;
    }

    const contact = await CRMContact.create({ 
      ...cleanBody(req.body), 
      customerId,
      tenantId: req.user.tenantId, 
      createdBy: req.user._id 
    });
    res.status(201).json(contact);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/contacts/:id', checkPermission('crm', 'update'), async (req, res) => {
  try {
    const contact = await CRMContact.findOneAndUpdate({ _id: req.params.id, ...req.tenantFilter }, cleanBody(req.body), { new: true, runValidators: true });
    if (!contact) return res.status(404).json({ error: 'Not found' });
    res.json(contact);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/contacts/:id', checkPermission('crm', 'delete'), async (req, res) => {
  try {
    const contact = await CRMContact.findOneAndDelete({ _id: req.params.id, ...req.tenantFilter });
    if (!contact) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ─────────── CAMPAIGNS ─────────── */

router.get('/campaigns', checkPermission('crm', 'read'), async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const filter = { ...req.tenantFilter };
    if (search) filter.name = { $regex: search, $options: 'i' };
    const skip = (Math.max(1, Number(page)) - 1) * Math.min(200, Math.max(1, Number(limit)));
    const parsedLimit = Math.min(200, Math.max(1, Number(limit)));
    const [campaigns, total] = await Promise.all([
      CRMCampaign.find(filter).sort('-createdAt').skip(skip).limit(parsedLimit).populate('createdBy', 'name').lean(),
      CRMCampaign.countDocuments(filter),
    ]);
    res.json({ campaigns, pagination: { page: Number(page), limit: parsedLimit, total, pages: Math.ceil(total / parsedLimit) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/campaigns', checkPermission('crm', 'create'), async (req, res) => {
  try {
    const campaign = await CRMCampaign.create({ 
      ...cleanBody(req.body), 
      tenantId: req.user.tenantId, 
      createdBy: req.user._id 
    });
    res.status(201).json(campaign);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/campaigns/:id', checkPermission('crm', 'update'), async (req, res) => {
  try {
    const campaign = await CRMCampaign.findOneAndUpdate({ _id: req.params.id, ...req.tenantFilter }, cleanBody(req.body), { new: true, runValidators: true });
    if (!campaign) return res.status(404).json({ error: 'Not found' });
    res.json(campaign);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/campaigns/:id', checkPermission('crm', 'delete'), async (req, res) => {
  try {
    const campaign = await CRMCampaign.findOneAndDelete({ _id: req.params.id, ...req.tenantFilter });
    if (!campaign) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/campaigns/:id/send', checkPermission('crm', 'create'), async (req, res) => {
  try {
    const campaign = await CRMCampaign.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!campaign) return res.status(404).json({ error: 'Not found' });
    if (campaign.status === 'completed' || campaign.status === 'running') return res.status(400).json({ error: 'Campaign already running or completed' });

    campaign.status = 'running';
    await campaign.save();

    // Fire and forget actual sending logic for this simplified demo
    setTimeout(async () => {
      // Dummy send logic
      campaign.status = 'completed';
      campaign.stats = { sent: 100, delivered: 95, failed: 5 };
      await campaign.save();
    }, 5000);

    res.json({ success: true, message: 'Campaign started' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
