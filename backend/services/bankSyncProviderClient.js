/**
 * Bank aggregator HTTP clients (Plaid + Salt Edge).
 * Uses native fetch. When credentials are missing or the network call fails,
 * sync falls back to demo transactions so reconciliation UX stays testable.
 */

const plaidHost = () => {
  const env = String(process.env.PLAID_ENV || 'sandbox').toLowerCase();
  if (env === 'production') return 'https://production.plaid.com';
  if (env === 'development') return 'https://development.plaid.com';
  return 'https://sandbox.plaid.com';
};

const saltHost = () => String(process.env.SALTEDGE_API_URL || 'https://www.saltedge.com/api/v5').replace(/\/$/, '');

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data?.error_message || data?.error?.message || `HTTP ${res.status}`);
    err.statusCode = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { method: 'GET', headers });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data?.error_message || data?.error?.message || `HTTP ${res.status}`);
    err.statusCode = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export function demoTransactions(provider = 'sandbox') {
  const today = new Date().toISOString().slice(0, 10);
  const prefix = String(provider || 'SB').toUpperCase().slice(0, 2);
  return [
    {
      date: today,
      label: `${provider} customer receipt`,
      reference: `${prefix}-IN-001`,
      amount: 2500,
      externalId: `${prefix}-demo-in-1`,
    },
    {
      date: today,
      label: `${provider} supplier payment`,
      reference: `${prefix}-OUT-001`,
      amount: -890.5,
      externalId: `${prefix}-demo-out-1`,
    },
    {
      date: today,
      label: `${provider} bank fee`,
      reference: `${prefix}-FEE-001`,
      amount: -12,
      externalId: `${prefix}-demo-fee-1`,
    },
  ];
}

/** Normalize provider payloads into bank statement line shape (+in / −out). */
export function normalizeProviderTransactions(rows = [], { provider = 'feed' } = {}) {
  return (Array.isArray(rows) ? rows : [])
    .map((row, idx) => {
      const amount = Number(
        row.amount
        ?? row.transaction_amount
        ?? (row.amount != null ? row.amount : null)
        ?? (row.made_amount != null ? row.made_amount : null),
      );
      // Plaid: positive = outflow (money leaving account). Invert to our convention (+in/−out).
      let signed = Number.isFinite(amount) ? amount : 0;
      if (provider === 'plaid' && row.amount != null && row.iso_currency_code != null) {
        signed = -Number(row.amount);
      }
      if (provider === 'saltedge' && row.amount != null && typeof row.amount === 'string') {
        signed = Number(row.amount);
      }
      const date = row.date || row.booking_date || row.made_on || row.authorized_date || new Date();
      const label = row.label
        || row.name
        || row.description
        || row.merchant_name
        || row.extra?.payee
        || `${provider} transaction`;
      const reference = row.reference
        || row.transaction_id
        || row.id
        || row.payment_meta?.reference_number
        || '';
      return {
        date: new Date(date),
        label: String(label).trim().slice(0, 240),
        reference: String(reference).trim().slice(0, 120),
        amount: Math.round(signed * 100) / 100,
        externalId: String(row.transaction_id || row.id || `${provider}-${idx}`),
      };
    })
    .filter((line) => Math.abs(line.amount) > 0.009);
}

export async function createPlaidLinkToken({ clientUserId, redirectUri } = {}) {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) throw new Error('Plaid credentials not configured');

  const body = {
    client_id: clientId,
    secret,
    client_name: process.env.PLAID_CLIENT_NAME || 'Maqder ERP',
    language: 'en',
    country_codes: String(process.env.PLAID_COUNTRY_CODES || 'SA,US').split(',').map((c) => c.trim()).filter(Boolean),
    user: { client_user_id: String(clientUserId || 'maqder-user') },
    products: String(process.env.PLAID_PRODUCTS || 'transactions').split(',').map((p) => p.trim()).filter(Boolean),
  };
  if (redirectUri) body.redirect_uri = redirectUri;

  const data = await postJson(`${plaidHost()}/link/token/create`, body);
  return {
    linkToken: data.link_token,
    expiration: data.expiration || null,
    requestId: data.request_id || null,
  };
}

export async function exchangePlaidPublicToken(publicToken) {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) throw new Error('Plaid credentials not configured');
  if (!publicToken) throw new Error('publicToken is required');

  const data = await postJson(`${plaidHost()}/item/public_token/exchange`, {
    client_id: clientId,
    secret,
    public_token: publicToken,
  });
  return {
    accessToken: data.access_token,
    itemId: data.item_id,
    requestId: data.request_id || null,
  };
}

export async function fetchPlaidTransactions(accessToken, { startDate = null, endDate = null } = {}) {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret || !accessToken) {
    return { lines: demoTransactions('plaid'), source: 'demo', error: null };
  }

  const end = endDate || new Date().toISOString().slice(0, 10);
  const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  try {
    const data = await postJson(`${plaidHost()}/transactions/get`, {
      client_id: clientId,
      secret,
      access_token: accessToken,
      start_date: start,
      end_date: end,
      options: { count: 100, offset: 0 },
    });
    const lines = normalizeProviderTransactions(data.transactions || [], { provider: 'plaid' });
    return { lines, source: 'plaid', error: null, total: data.total_transactions };
  } catch (error) {
    return {
      lines: demoTransactions('plaid'),
      source: 'demo_fallback',
      error: error.message,
    };
  }
}

export async function createSaltEdgeConnectSession({ customerId, redirectUri, state } = {}) {
  const appId = process.env.SALTEDGE_APP_ID;
  const secret = process.env.SALTEDGE_SECRET;
  if (!appId || !secret) throw new Error('Salt Edge credentials not configured');

  const data = await postJson(`${saltHost()}/connect_sessions/create`, {
    data: {
      customer_id: customerId || undefined,
      consent: { scopes: ['account_details', 'transactions_details'] },
      attempt: {
        return_to: redirectUri || `${String(process.env.FRONTEND_URL || '').replace(/\/$/, '')}/app/dashboard/accounting/online-sync`,
        custom_fields: { state: state || '' },
      },
    },
  }, {
    'App-id': appId,
    Secret: secret,
  });

  return {
    connectUrl: data?.data?.connect_url || null,
    expiresAt: data?.data?.expires_at || null,
    raw: data?.data || null,
  };
}

export async function fetchSaltEdgeTransactions(connectionId, { fromDate = null } = {}) {
  const appId = process.env.SALTEDGE_APP_ID;
  const secret = process.env.SALTEDGE_SECRET;
  if (!appId || !secret || !connectionId) {
    return { lines: demoTransactions('saltedge'), source: 'demo', error: null };
  }

  const from = fromDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  try {
    const qs = new URLSearchParams({
      connection_id: String(connectionId),
      from_date: from,
      per_page: '100',
    });
    const data = await getJson(`${saltHost()}/transactions?${qs}`, {
      'App-id': appId,
      Secret: secret,
    });
    const rows = (data?.data || []).map((row) => ({
      ...row,
      amount: row.amount,
      date: row.made_on,
      description: row.description,
      id: row.id,
    }));
    return {
      lines: normalizeProviderTransactions(rows, { provider: 'saltedge' }),
      source: 'saltedge',
      error: null,
    };
  } catch (error) {
    return {
      lines: demoTransactions('saltedge'),
      source: 'demo_fallback',
      error: error.message,
    };
  }
}

/**
 * Pull statement lines for a connected provider.
 * Prefer live API when tokens exist; otherwise demo / GL mirror is handled by caller.
 */
export async function fetchProviderStatementLines(provider, metadata = {}) {
  const id = String(provider || '').toLowerCase();
  if (id === 'plaid') {
    return fetchPlaidTransactions(metadata.accessToken || metadata.access_token);
  }
  if (id === 'saltedge') {
    return fetchSaltEdgeTransactions(metadata.connectionId || metadata.connection_id);
  }
  return { lines: demoTransactions('sandbox'), source: 'demo', error: null };
}

export default {
  demoTransactions,
  normalizeProviderTransactions,
  createPlaidLinkToken,
  exchangePlaidPublicToken,
  fetchPlaidTransactions,
  createSaltEdgeConnectSession,
  fetchSaltEdgeTransactions,
  fetchProviderStatementLines,
};
