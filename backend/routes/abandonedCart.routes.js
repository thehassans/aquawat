import express from 'express';
import mongoose from 'mongoose';
import { resolveTenantByHost } from '../middleware/resolveTenantByHost.js';
import { protect } from '../middleware/auth.js';
import { resolveTenantId, handleTenantScopeError } from '../utils/tenantScope.js';
import AbandonedCart from '../models/AbandonedCart.js';
import EcommerceOrder from '../models/EcommerceOrder.js';
import Tenant from '../models/Tenant.js';
import { sendTenantEmail } from '../utils/tenantEmailService.js';

const router = express.Router();

// Public: upsert abandoned cart (called from storefront when cart updates)
router.post('/track', resolveTenantByHost, async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { cartId, customerEmail, customerPhone, items, cartTotal } = req.body;

    if (!cartId || !items || items.length === 0) {
      return res.status(400).json({ error: 'cartId and items are required' });
    }

    // Only track if we have an email or phone
    if (!customerEmail && !customerPhone) {
      return res.json({ skipped: true });
    }

    const existing = await AbandonedCart.findOne({ tenantId, cartId });

    if (existing) {
      existing.items = items;
      existing.cartTotal = cartTotal;
      existing.customerEmail = customerEmail || existing.customerEmail;
      existing.customerPhone = customerPhone || existing.customerPhone;
      // If cart was recovered but updated again, reset
      if (existing.status === 'recovered') {
        existing.status = 'abandoned';
        existing.recoveryEmailSent = false;
      }
      await existing.save();
    } else {
      await AbandonedCart.create({
        tenantId, cartId, customerEmail, customerPhone, items, cartTotal,
      });
    }

    res.json({ tracked: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public: mark cart as recovered (called when order is placed)
router.post('/recover/:cartId', resolveTenantByHost, async (req, res) => {
  try {
    const tenantId = req.storeTenant._id;
    const { orderId } = req.body;

    const cart = await AbandonedCart.findOneAndUpdate(
      { tenantId, cartId: req.params.cartId },
      { status: 'recovered', recoveredAt: new Date(), recoveredOrderId: orderId || null },
      { new: true }
    );

    res.json({ recovered: !!cart });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: list abandoned carts
router.get('/', protect, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req.user, req);
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { tenantId };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [carts, total] = await Promise.all([
      AbandonedCart.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      AbandonedCart.countDocuments(filter),
    ]);

    res.json({ carts, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// Admin: abandoned cart stats
router.get('/stats', protect, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req.user, req);
    const [abandoned, recovered, emailed] = await Promise.all([
      AbandonedCart.countDocuments({ tenantId, status: 'abandoned' }),
      AbandonedCart.countDocuments({ tenantId, status: 'recovered' }),
      AbandonedCart.countDocuments({ tenantId, recoveryEmailSent: true }),
    ]);
    const lostRevenueResult = await AbandonedCart.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), status: 'abandoned' } },
      { $group: { _id: null, total: { $sum: '$cartTotal' } } },
    ]);
    const recoveredRevenueResult = await AbandonedCart.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), status: 'recovered' } },
      { $group: { _id: null, total: { $sum: '$cartTotal' } } },
    ]);
    res.json({
      abandoned,
      recovered,
      emailed,
      lostRevenue: lostRevenueResult[0]?.total || 0,
      recoveredRevenue: recoveredRevenueResult[0]?.total || 0,
    });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process abandoned carts — send recovery emails for carts abandoned > 2 hours.
 * Called by cron job.
 */
export async function processAbandonedCarts() {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const carts = await AbandonedCart.find({
      status: 'abandoned',
      recoveryEmailSent: false,
      customerEmail: { $ne: '' },
      updatedAt: { $lt: twoHoursAgo },
    }).limit(50);

    for (const cart of carts) {
      try {
        const tenant = await Tenant.findById(cart.tenantId);
        if (!tenant) continue;

        const storeName = tenant.ecommerce?.storeName || tenant.name || 'Store';
        const itemsHtml = cart.items.map(i =>
          `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${i.title}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${i.quantity}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${i.price} SAR</td></tr>`
        ).join('');

        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <div style="background:#4f46e5;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:22px;">${storeName}</h1>
            </div>
            <div style="background:#f9fafb;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;">
              <h2 style="color:#111;margin:0 0 8px;">You left items in your cart!</h2>
              <p style="color:#6b7280;margin:0 0 16px;">We noticed you didn't complete your purchase. Here's what's waiting for you:</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <thead><tr><th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb;">Item</th><th style="padding:8px;border-bottom:2px solid #e5e7eb;">Qty</th><th style="padding:8px;text-align:right;border-bottom:2px solid #e5e7eb;">Price</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
              </table>
              <div style="text-align:center;margin:24px 0;">
                <a href="${process.env.FRONTEND_URL || ''}/store/checkout" style="display:inline-block;padding:14px 32px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Complete Your Order</a>
              </div>
              <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;text-align:center;">This is an automated message from ${storeName}.</p>
            </div>
          </div>
        `;

        await sendTenantEmail({
          tenant,
          to: cart.customerEmail,
          subject: `Complete your purchase at ${storeName}`,
          html,
          text: `You left items in your cart at ${storeName}. Total: ${cart.cartTotal} SAR`,
          metadata: { type: 'abandoned_cart', cartId: cart.cartId },
        });

        cart.recoveryEmailSent = true;
        cart.recoveryEmailSentAt = new Date();
        await cart.save();
      } catch (e) {
        // Silent fail for individual carts
      }
    }
  } catch (error) {
    // Silent fail
  }
}

export default router;
