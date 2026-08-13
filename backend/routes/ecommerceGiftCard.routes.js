import express from 'express';
import { resolveTenantId, handleTenantScopeError } from '../utils/tenantScope.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import Tenant from '../models/Tenant.js';
import EcommerceGiftCard from '../models/EcommerceGiftCard.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

const getTargetTenantId = (user, req) => resolveTenantId(user, req);

// --- ADMIN: List gift cards ---
router.get('/', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found' });

    const { status, search, page = 1, limit = 25 } = req.query;
    const filter = { tenantId };
    if (status) filter.status = status;
    if (search) filter.code = { $regex: search, $options: 'i' };

    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const [cards, total] = await Promise.all([
      EcommerceGiftCard.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      EcommerceGiftCard.countDocuments(filter),
    ]);

    res.json({ giftCards: cards, total, totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN: Create gift card ---
router.post('/', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found' });

    const { amount, recipientName, recipientEmail, note, expiresAt } = req.body;
    if (!amount || amount < 1) return res.status(400).json({ error: 'Amount must be at least 1' });

    const currency = (await Tenant.findById(tenantId).lean())?.ecommerce?.currency || 'SAR';

    let code;
    let existing;
    do {
      code = EcommerceGiftCard.generateCode();
      existing = await EcommerceGiftCard.findOne({ code });
    } while (existing);

    const card = await EcommerceGiftCard.create({
      tenantId,
      code,
      amount,
      balance: amount,
      currency,
      recipientName: recipientName || '',
      recipientEmail: recipientEmail || '',
      note: note || '',
      expiresAt: expiresAt || null,
      createdById: req.user._id,
    });

    res.status(201).json(card);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN: Update gift card (disable/enable) ---
router.put('/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found' });

    const { status } = req.body;
    const card = await EcommerceGiftCard.findOne({ _id: req.params.id, tenantId });
    if (!card) return res.status(404).json({ error: 'Gift card not found' });

    if (status) card.status = status;
    await card.save();
    res.json(card);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN: Delete gift card ---
router.delete('/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found' });

    const card = await EcommerceGiftCard.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!card) return res.status(404).json({ error: 'Gift card not found' });
    res.json({ success: true });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN: Stats ---
router.get('/stats', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found' });

    const stats = await EcommerceGiftCard.aggregate([
      { $match: { tenantId: tenantId } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalValue: { $sum: '$amount' },
        totalBalance: { $sum: '$balance' },
      }},
    ]);

    const result = { active: 0, redeemed: 0, expired: 0, disabled: 0, totalValue: 0, totalBalance: 0 };
    stats.forEach(s => {
      result[s._id] = s.count;
      result.totalValue += s.totalValue;
      result.totalBalance += s.totalBalance;
    });

    res.json(result);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

export default router;
