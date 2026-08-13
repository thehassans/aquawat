import { isPastDueInRiyadh } from './riyadhTime.js';
import { roundMoney } from './money.js';

export function applyPaidAmountStatus(invoiceData, now = new Date()) {
  const grandTotal = Number(invoiceData.grandTotal) || 0;
  const paid = Math.min(Math.max(0, Number(invoiceData.paidAmount) || 0), grandTotal);
  invoiceData.paidAmount = roundMoney(paid);
  if (grandTotal > 0 && invoiceData.paidAmount >= grandTotal - 0.005) {
    invoiceData.paidAmount = grandTotal;
    invoiceData.paymentStatus = 'paid';
    return invoiceData;
  }
  if (invoiceData.paidAmount > 0) {
    invoiceData.paymentStatus = isPastDueInRiyadh(invoiceData.dueDate, now) ? 'overdue' : 'partial';
    return invoiceData;
  }
  invoiceData.paymentStatus = isPastDueInRiyadh(invoiceData.dueDate, now) ? 'overdue' : 'pending';
  return invoiceData;
}

export function resolvePaymentStatus(invoiceData, now = new Date()) {
  const method = invoiceData.paymentMethod || 'cash';
  const grandTotal = Number(invoiceData.grandTotal) || 0;

  if (method === 'credit' || method === 'split' || method === 'khata') {
    return applyPaidAmountStatus(invoiceData, now);
  }

  invoiceData.paidAmount = grandTotal;
  invoiceData.paymentStatus = 'paid';
  return invoiceData;
}

export function isOverpay(paidAmount, grandTotal) {
  const paid = Number(paidAmount);
  const grand = Number(grandTotal);
  return Number.isFinite(paid) && Number.isFinite(grand) && paid > grand + 0.005;
}

export default { applyPaidAmountStatus, resolvePaymentStatus, isOverpay };
