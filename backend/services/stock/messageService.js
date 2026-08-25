import mongoose from 'mongoose';
import StockMessage from '../../models/stock/StockMessage.js';

export async function listMessages(tenantId, resModel, resId) {
  return StockMessage.find({
    tenantId,
    resModel,
    resId,
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
}

export async function postMessage(tenantId, user, {
  resModel = 'StockPicking',
  resId,
  body,
  messageType = 'comment',
}) {
  const authorName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
    || user?.email
    || 'User';
  const [doc] = await StockMessage.create([{
    tenantId,
    resModel,
    resId,
    body: String(body || '').trim(),
    messageType,
    authorId: user?._id || null,
    authorName,
    createdBy: user?._id || null,
  }]);
  return doc;
}

export async function logSystemMessage(tenantId, resId, body, userId = null) {
  try {
    await StockMessage.create([{
      tenantId: new mongoose.Types.ObjectId(String(tenantId)),
      resModel: 'StockPicking',
      resId: new mongoose.Types.ObjectId(String(resId)),
      body,
      messageType: 'notification',
      authorId: userId || null,
      authorName: 'System',
      createdBy: userId || null,
    }]);
  } catch (err) {
    console.warn('[stock chatter]', err.message);
  }
}
