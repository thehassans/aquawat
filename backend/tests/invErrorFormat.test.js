import test from 'node:test';
import assert from 'node:assert/strict';

// Mirror frontend/src/lib/invError.js for contract lock
function formatInvError(err, language = 'en') {
  const ar = language === 'ar' || language === 'ar-SA';
  const data = err?.response?.data;
  const nested = data?.error;

  if (nested && typeof nested === 'object') {
    const msg = ar
      ? (nested.messageAr || nested.message || nested.code)
      : (nested.message || nested.messageAr || nested.code);
    if (msg) return String(msg);
  }

  if (typeof nested === 'string' && nested) return nested;
  if (typeof data?.message === 'string' && data.message) return data.message;
  if (typeof data?.error === 'string' && data.error) return data.error;
  if (typeof err?.message === 'string' && err.message && err.message !== 'Error') return err.message;
  return ar ? 'حدث خطأ' : 'Something went wrong';
}

test('formatInvError unwraps inventory nested error object (React #31 fix)', () => {
  const err = {
    response: {
      data: {
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: 'Insufficient stock — only 10 available in inventory',
          messageAr: 'المخزون غير كافٍ — المتاح في المخزون 10 فقط',
        },
      },
    },
  };
  assert.equal(
    formatInvError(err, 'en'),
    'Insufficient stock — only 10 available in inventory',
  );
  assert.equal(
    formatInvError(err, 'ar'),
    'المخزون غير كافٍ — المتاح في المخزون 10 فقط',
  );
  assert.equal(typeof formatInvError(err, 'en'), 'string');
});
