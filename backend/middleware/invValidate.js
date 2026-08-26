import { z } from 'zod';
import { sendInvError } from '../services/inventory/apiContract.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

export const validateTransferBody = z.object({
  createBackorder: z.union([
    z.enum(['ask', 'always', 'never']),
    z.boolean(),
  ]).optional().nullable(),
  immediate: z.boolean().optional(),
  moveQuantities: z.array(z.object({
    moveId: objectId,
    quantity: z.union([z.number(), z.string()]),
  })).optional(),
}).passthrough();

export const posConsumeBody = z.object({
  warehouseId: objectId,
  orderRef: z.string().max(200).optional(),
  origin: z.string().max(200).optional(),
  note: z.string().max(2000).optional(),
  partnerId: objectId.optional().nullable(),
  lines: z.array(z.object({
    productId: objectId,
    qty: z.union([z.number(), z.string()]).optional(),
    quantity: z.union([z.number(), z.string()]).optional(),
    demandQty: z.union([z.number(), z.string()]).optional(),
  }).refine((l) => l.qty != null || l.quantity != null || l.demandQty != null, {
    message: 'qty required',
  })).min(1),
}).passthrough();

export const applyCountsBody = z.object({
  ids: z.array(objectId).min(1),
  accountingDate: z.union([z.string(), z.coerce.date()]).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
  reasonCode: z.enum([
    'damage',
    'theft_loss',
    'expiry',
    'found',
    'supplier_shortage',
    'data_entry_error',
  ]),
}).passthrough();

export const integrityRunBody = z.object({
  limit: z.coerce.number().int().positive().max(5000).optional(),
  async: z.boolean().optional(),
}).passthrough();

/** Express middleware: validate req.body with a Zod schema → req.validatedBody */
export function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendInvError(res, parsed.error);
    }
    req.validatedBody = parsed.data;
    return next();
  };
}
