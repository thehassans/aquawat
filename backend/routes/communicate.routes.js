import express from 'express';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

// GET /api/communicate/users — list all users in tenant for @mention
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ ...req.tenantFilter, isActive: { $ne: false } })
      .select('name email role _id')
      .limit(50);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/communicate — inbox (messages to me OR from me, deduplicated by conversation)
router.get('/', async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 50, unread } = req.query;

    const filter = {
      ...req.tenantFilter,
      thread: { $exists: false }, // top-level only
      isDeleted: false,
      $or: [
        { fromUser: userId },
        { toUser: userId },
        { toUser: null }, // broadcasts
      ]
    };
    if (unread === 'true') filter.isRead = false;

    const messages = await Message.find(filter)
      .populate('fromUser', 'name email role')
      .populate('toUser', 'name email role')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    // Attach reply counts
    const ids = messages.map(m => m._id);
    const replyCounts = await Message.aggregate([
      { $match: { thread: { $in: ids }, isDeleted: false } },
      { $group: { _id: '$thread', count: { $sum: 1 } } }
    ]);
    const replyMap = {};
    replyCounts.forEach(r => { replyMap[r._id.toString()] = r.count; });

    const total = await Message.countDocuments(filter);
    const unreadCount = await Message.countDocuments({
      ...req.tenantFilter,
      toUser: userId,
      isRead: false,
      isDeleted: false
    });

    res.json({
      messages: messages.map(m => ({ ...m.toObject(), replyCount: replyMap[m._id.toString()] || 0 })),
      total,
      unreadCount,
      page: Number(page),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/communicate/threads/:id — get thread replies
router.get('/threads/:id', async (req, res) => {
  try {
    const parent = await Message.findOne({ _id: req.params.id, ...req.tenantFilter, isDeleted: false })
      .populate('fromUser', 'name email role')
      .populate('toUser', 'name email role');
    if (!parent) return res.status(404).json({ error: 'Message not found' });

    const replies = await Message.find({ thread: parent._id, isDeleted: false })
      .populate('fromUser', 'name email role')
      .sort({ createdAt: 1 });

    res.json({ parent, replies });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/communicate — send a message
router.post('/', async (req, res) => {
  try {
    const { toUser, body, thread, tags } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Message body is required.' });

    const msg = new Message({
      tenantId: req.user.tenantId,
      fromUser: req.user._id,
      toUser: toUser || null,
      body: body.trim(),
      thread: thread || undefined,
      tags: Array.isArray(tags) ? tags : [],
    });
    await msg.save();
    await msg.populate('fromUser', 'name email role');
    await msg.populate('toUser', 'name email role');
    res.status(201).json(msg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/communicate/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    const msg = await Message.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter, toUser: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    res.json(msg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/communicate/:id/close
router.patch('/:id/close', async (req, res) => {
  try {
    // Both sender and recipient of the parent message can close the thread
    const msg = await Message.findOneAndUpdate(
      { 
        _id: req.params.id, 
        ...req.tenantFilter,
        $or: [{ fromUser: req.user._id }, { toUser: req.user._id }]
      },
      { isClosed: true },
      { new: true }
    );
    if (!msg) return res.status(404).json({ error: 'Message not found or not authorized' });
    res.json(msg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/communicate/:id (soft delete, own messages only)
router.delete('/:id', async (req, res) => {
  try {
    const msg = await Message.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter, fromUser: req.user._id },
      { isDeleted: true },
      { new: true }
    );
    if (!msg) return res.status(404).json({ error: 'Not found or not authorized' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
