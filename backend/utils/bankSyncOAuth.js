import crypto from 'crypto';

/**
 * Resolve bank-sync provider catalog from env credentials.
 * Live aggregators stay coming_soon until client id/secret are configured.
 */
export function resolveBankSyncProviders() {
  const plaidReady = Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
  const saltReady = Boolean(process.env.SALTEDGE_APP_ID && process.env.SALTEDGE_SECRET);

  return [
    { id: 'sandbox', name: 'Sandbox Bank (Demo)', nameAr: 'بنك تجريبي', oauth: true, status: 'available' },
    {
      id: 'saltedge',
      name: 'Salt Edge',
      nameAr: 'Salt Edge',
      oauth: true,
      status: saltReady ? 'available' : 'coming_soon',
      credentialHint: saltReady ? null : 'Set SALTEDGE_APP_ID and SALTEDGE_SECRET',
    },
    {
      id: 'plaid',
      name: 'Plaid',
      nameAr: 'Plaid',
      oauth: true,
      status: plaidReady ? 'available' : 'coming_soon',
      credentialHint: plaidReady ? null : 'Set PLAID_CLIENT_ID and PLAID_SECRET',
    },
  ];
}

export function getBankSyncProviderMeta(providerId) {
  const id = String(providerId || '').trim().toLowerCase();
  return resolveBankSyncProviders().find((p) => p.id === id) || null;
}

export function createOAuthState(tenantId, provider) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = Buffer.from(JSON.stringify({
    tenantId: String(tenantId),
    provider: String(provider || '').toLowerCase(),
    nonce,
    exp: Date.now() + 15 * 60 * 1000,
  })).toString('base64url');
  const secret = process.env.BANK_SYNC_OAUTH_STATE_SECRET
    || process.env.JWT_SECRET
    || 'maqder-bank-sync';
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function parseOAuthState(state) {
  const [payload, sig] = String(state || '').split('.');
  if (!payload || !sig) return null;
  const secret = process.env.BANK_SYNC_OAUTH_STATE_SECRET
    || process.env.JWT_SECRET
    || 'maqder-bank-sync';
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.tenantId || !data?.provider || !data?.exp || Date.now() > Number(data.exp)) return null;
    return data;
  } catch {
    return null;
  }
}

export function buildAuthorizeUrl(provider, { state, redirectUri } = {}) {
  const id = String(provider || '').toLowerCase();
  const redirect = redirectUri || `${String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/app/dashboard/accounting/online-sync`;

  if (id === 'plaid') {
    const clientId = process.env.PLAID_CLIENT_ID;
    const env = process.env.PLAID_ENV || 'sandbox';
    // Link token flow is server-side; expose a redirect that completes via our callback.
    const base = env === 'production'
      ? 'https://cdn.plaid.com/link/v2/stable/link.html'
      : 'https://cdn.plaid.com/link/v2/stable/link.html';
    const params = new URLSearchParams({
      isWebview: 'true',
      token: 'pending',
      receivedRedirectUri: redirect,
      state: state || '',
      client_id: clientId || '',
    });
    return {
      authorizeUrl: `${base}?${params.toString()}`,
      mode: 'plaid_link_scaffold',
      note: 'Complete connection via POST /accounting/bank-sync/oauth/callback after Link success.',
    };
  }

  if (id === 'saltedge') {
    const appId = process.env.SALTEDGE_APP_ID;
    const params = new URLSearchParams({
      app_id: appId || '',
      redirect_uri: redirect,
      state: state || '',
    });
    return {
      authorizeUrl: `https://www.saltedge.com/connect?${params.toString()}`,
      mode: 'saltedge_connect_scaffold',
      note: 'Complete connection via POST /accounting/bank-sync/oauth/callback after customer returns.',
    };
  }

  return { authorizeUrl: null, mode: 'sandbox_stub', note: null };
}

export default {
  resolveBankSyncProviders,
  getBankSyncProviderMeta,
  createOAuthState,
  parseOAuthState,
  buildAuthorizeUrl,
};
