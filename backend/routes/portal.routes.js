import express from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import PortalUser from '../models/sales/PortalUser.js';
import SalesSettings from '../models/sales/SalesSettings.js';
import Partner from '../models/Partner.js';
import Quotation from '../models/Quotation.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Invoice from '../models/Invoice.js';
import Tenant from '../models/Tenant.js';
import { protect, tenantFilter, checkPermission, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

const portalToken = (user) => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(
    { id: String(user._id), tenantId: String(user.tenantId), portal: true, partnerId: String(user.partnerId) },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );
};

const protectPortal = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.portal_token;
    if (!token) return res.status(401).json({ error: 'Not authorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.portal) return res.status(401).json({ error: 'Invalid portal token' });
    const user = await PortalUser.findById(decoded.id).select('+password').lean();
    if (!user || !user.isActive) return res.status(401).json({ error: 'Account inactive' });
    req.portalUser = user;
    req.tenantFilter = { tenantId: user.tenantId };
    next();
  } catch {
    return res.status(401).json({ error: 'Not authorized' });
  }
};

/** Resolve tenant from subdomain slug (e.g. foody-silver-establishment.maqder.com) */
router.get('/tenant-by-host', async (req, res) => {
  try {
    const host = String(req.query.host || req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0];
    const slug = host.split('.')[0];
    if (!slug || slug === 'www' || slug === 'maqder') {
      return res.status(400).json({ error: 'Tenant slug required' });
    }
    const tenant = await Tenant.findOne({ slug }).select('name slug business').lean();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const settings = await SalesSettings.findOne({ tenantId: tenant._id }).select('portalSignupMode').lean();
    res.json({ tenant, portalSignupMode: settings?.portalSignupMode || 'invitation_only' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/auth/signup', async (req, res) => {
  try {
    const { tenantId, email, password, name, partnerId } = req.body;
    const settings = await SalesSettings.findOne({ tenantId }).lean();
    if (!settings || settings.portalSignupMode !== 'free_signup') {
      return res.status(403).json({ error: 'Free signup is disabled for this tenant' });
    }
    const partner = await Partner.findOne({ _id: partnerId, tenantId, isCustomer: true });
    if (!partner) return res.status(400).json({ error: 'Valid customer account required' });

    const existing = await PortalUser.findOne({ tenantId, email: String(email).toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const user = await PortalUser.create({
      tenantId,
      partnerId: partner._id,
      email,
      password,
      name: name || partner.name,
      accessSource: 'free_signup',
    });

    res.status(201).json({ token: portalToken(user), user: { id: user._id, email: user.email, name: user.name } });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { tenantId, email, password } = req.body;
    const user = await PortalUser.findOne({ tenantId, email: String(email).toLowerCase() }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.isActive) return res.status(403).json({ error: 'Account disabled' });
    user.lastLoginAt = new Date();
    await user.save();
    res.json({ token: portalToken(user), user: { id: user._id, email: user.email, name: user.name, partnerId: user.partnerId } });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/auth/accept-invite', async (req, res) => {
  try {
    const { token, password, name } = req.body;
    const user = await PortalUser.findOne({ inviteToken: token }).select('+password');
    if (!user) return res.status(404).json({ error: 'Invalid invitation' });
    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
      return res.status(410).json({ error: 'Invitation expired' });
    }
    user.password = password;
    user.name = name || user.name;
    user.inviteToken = null;
    user.inviteExpiresAt = null;
    user.isActive = true;
    user.accessSource = 'invitation';
    await user.save();
    res.json({ token: portalToken(user), user: { id: user._id, email: user.email, name: user.name } });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Magic-link login — issues a one-time token emailed/returned for portal auth */
router.post('/auth/magic-link', async (req, res) => {
  try {
    const { tenantId, email } = req.body || {};
    const user = await PortalUser.findOne({ tenantId, email: String(email || '').toLowerCase() });
    if (!user) return res.status(404).json({ error: 'Portal account not found' });
    if (!user.isActive) return res.status(403).json({ error: 'Account disabled' });

    const token = randomBytes(32).toString('hex');
    user.inviteToken = token;
    user.inviteExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    res.json({
      magicLink: `/portal/accept-invite?token=${token}&magic=1`,
      expiresAt: user.inviteExpiresAt,
      message: 'Magic link generated — send to customer email',
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/auth/magic-login', async (req, res) => {
  try {
    const { token } = req.body || {};
    const user = await PortalUser.findOne({ inviteToken: token });
    if (!user) return res.status(404).json({ error: 'Invalid or expired magic link' });
    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
      return res.status(410).json({ error: 'Magic link expired' });
    }
    user.inviteToken = null;
    user.inviteExpiresAt = null;
    user.lastLoginAt = new Date();
    await user.save();
    res.json({ token: portalToken(user), user: { id: user._id, email: user.email, name: user.name, partnerId: user.partnerId } });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Customer signs a quotation / sales order via portal */
router.post('/sign/:documentType/:documentId', protectPortal, async (req, res) => {
  try {
    const { documentType, documentId } = req.params;
    const { signatureData, signedBy } = req.body || {};
    const { tenantId, partnerId } = req.portalUser;

    if (documentType === 'quotation') {
      const doc = await Quotation.findOne({ _id: documentId, tenantId, customerId: partnerId });
      if (!doc) return res.status(404).json({ error: 'Quotation not found' });
      doc.signatureData = signatureData || '';
      doc.signedAt = new Date();
      doc.signedBy = signedBy || req.portalUser.name || req.portalUser.email;
      await doc.save();
      return res.json({ signed: true, documentId: doc._id });
    }

    if (documentType === 'sales-order') {
      const doc = await PurchaseOrder.findOne({ _id: documentId, tenantId, customerId: partnerId, flow: 'sell' });
      if (!doc) return res.status(404).json({ error: 'Sales order not found' });
      doc.signatureData = signatureData || '';
      doc.signedAt = new Date();
      doc.signedBy = signedBy || req.portalUser.name || req.portalUser.email;
      await doc.save();
      return res.json({ signed: true, documentId: doc._id });
    }

    return res.status(400).json({ error: 'Unsupported document type' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/documents', protectPortal, async (req, res) => {
  try {
    const { partnerId, tenantId } = req.portalUser;
    const [quotations, orders, invoices] = await Promise.all([
      Quotation.find({ tenantId, customerId: partnerId }).sort('-createdAt').limit(100).select('quotationNumber status grandTotal currency validUntil createdAt').lean(),
      PurchaseOrder.find({ tenantId, customerId: partnerId, flow: 'sell' }).sort('-orderDate').limit(100).select('poNumber status grandTotal currency orderDate').lean(),
      Invoice.find({ tenantId, customerId: partnerId, invoiceType: 'sell' }).sort('-invoiceDate').limit(100).select('invoiceNumber status grandTotal currency invoiceDate invoiceSubtype').lean(),
    ]);
    res.json({ quotations, salesOrders: orders, invoices });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Admin: invite portal user for a partner (staff auth required) */
router.post('/invite', protect, tenantFilter, requireTenantFilter, checkPermission('sales', 'create'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { partnerId, email, name } = req.body || {};
    if (!partnerId || !email) {
      return res.status(400).json({ error: 'partnerId and email are required' });
    }

    const partner = await Partner.findOne({ _id: partnerId, tenantId }).select('_id').lean();
    if (!partner) return res.status(404).json({ error: 'Partner not found' });

    const token = randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);

    const user = await PortalUser.findOneAndUpdate(
      { tenantId, email: String(email).toLowerCase() },
      {
        tenantId,
        partnerId,
        email: String(email).toLowerCase(),
        name: name || '',
        password: randomBytes(16).toString('hex'),
        accessSource: 'invitation',
        inviteToken: token,
        inviteExpiresAt: expires,
        isActive: false,
      },
      { upsert: true, new: true },
    );

    res.status(201).json({
      userId: user._id,
      inviteUrl: `/portal/accept-invite?token=${token}`,
      expiresAt: expires,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
