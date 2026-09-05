/**
 * Helpers for company negative cash/bank balance policy (off / warning / block).
 */

export function negativeCashErrorPayload(error) {
  const data = error?.response?.data
  if (!data) return null
  if (data.code === 'NEGATIVE_CASH_WARNING' || data.code === 'NEGATIVE_CASH_BLOCKED') return data
  // liquidity-check returns the evaluation object at top level
  if (data.requiresConfirmation || data.blocked) return data
  return null
}

export function formatNegativeCashConfirmMessage(payload, isAr = false) {
  const details = payload?.details || payload
  const account = details?.account || {}
  const label = [account.code, isAr ? (account.nameAr || account.name) : account.name]
    .filter(Boolean)
    .join(' ')
  const currency = account.currency || 'SAR'
  const projected = Number(details?.projectedBalance)
  const amountStr = Number.isFinite(projected) ? projected.toFixed(2) : String(details?.projectedBalance ?? '')
  if (isAr) {
    return `بعد هذه الدفعة سيصبح رصيد ${label || 'الحساب'} ${amountStr} ${currency}. هل تريد المتابعة؟`
  }
  return `This payment will take ${label || 'the account'} balance to ${amountStr} ${currency}. Continue?`
}

export function formatNegativeCashBlockMessage(payload, isAr = false) {
  const details = payload?.details || payload
  const account = details?.account || {}
  const label = [account.code, isAr ? (account.nameAr || account.name) : account.name]
    .filter(Boolean)
    .join(' ')
  const currency = account.currency || 'SAR'
  const projected = Number(details?.projectedBalance)
  const amountStr = Number.isFinite(projected) ? projected.toFixed(2) : String(details?.projectedBalance ?? '')
  if (isAr) {
    return `لا يمكن ترحيل الدفعة: رصيد ${label || 'الحساب'} سيصبح ${amountStr} ${currency}.`
  }
  return `Cannot post payment: ${label || 'account'} would go to ${amountStr} ${currency}.`
}

/**
 * Preflight liquidity check. Returns { ok, confirmNegativeCash }.
 * Shows confirm/alert dialogs for warning/block policies.
 */
export async function runLiquidityPreflight(api, { amount, method, accountId }, isAr = false) {
  try {
    const { data } = await api.post('/accounting/liquidity-check', {
      amount,
      paymentMethod: method,
      accountId: accountId || undefined,
    })
    if (data?.ok !== false) {
      return { ok: true, confirmNegativeCash: false }
    }
  } catch (err) {
    const payload = negativeCashErrorPayload(err) || err?.response?.data
    if (!payload) throw err
    if (payload.code === 'NEGATIVE_CASH_BLOCKED' || payload.blocked) {
      window.alert(formatNegativeCashBlockMessage(payload, isAr))
      return { ok: false, confirmNegativeCash: false }
    }
    if (payload.code === 'NEGATIVE_CASH_WARNING' || payload.requiresConfirmation) {
      const accepted = window.confirm(formatNegativeCashConfirmMessage(payload, isAr))
      return { ok: accepted, confirmNegativeCash: accepted }
    }
    throw err
  }
  return { ok: true, confirmNegativeCash: false }
}

/** Handle 409/400 from a payment POST that already ran the check server-side. */
export function handleNegativeCashPaymentError(error, isAr = false) {
  const payload = negativeCashErrorPayload(error)
  if (!payload) return { handled: false }
  if (payload.code === 'NEGATIVE_CASH_BLOCKED' || payload.blocked) {
    window.alert(formatNegativeCashBlockMessage(payload, isAr))
    return { handled: true, retry: false }
  }
  if (payload.code === 'NEGATIVE_CASH_WARNING' || payload.requiresConfirmation) {
    const accepted = window.confirm(formatNegativeCashConfirmMessage(payload, isAr))
    return { handled: true, retry: accepted }
  }
  return { handled: false }
}
