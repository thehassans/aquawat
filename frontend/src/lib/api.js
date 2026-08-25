import axios from 'axios'
import { enqueueSyncItem, initDb } from './syncEngine'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

export const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads')) {
    // Determine the base API URL dynamically based on the current window location or env var
    // If apiBaseUrl is absolute (e.g. https://maqder.com/api or desktop app), use it
    if (apiBaseUrl.startsWith('http')) {
       try {
         const urlObj = new URL(apiBaseUrl);
         return `${urlObj.origin}/api${url}`; // e.g. https://maqder.com/api/uploads/...
       } catch (e) {
         return url;
       }
    }
    // For local web or relative paths, return /api/uploads/... so Nginx/Vite proxies it to the backend
    return `/api${url}`;
  }
  return url;
}

const getApiErrorMessage = (error) => {
  const raw = error.response?.data?.error
  const responseMessage = typeof raw === 'string' ? raw : raw?.message

  if (responseMessage) {
    return responseMessage
  }

  if (error.response?.status === 429) {
    return 'The server is temporarily busy. Automatically retrying in a moment...'
  }

  if (error.response?.status === 502 || error.response?.status === 503 || error.response?.status === 504) {
    return 'The service is temporarily unavailable. Please try again in a moment.'
  }

  if (error.code === 'ECONNABORTED') {
    return 'The request timed out. Please try again.'
  }

  if (!error.response) {
    return 'Unable to reach the server. Please check your internet connection or server status.'
  }

  return error.message || 'Request failed'
}

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 45000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// In-flight GET request deduplication pool to prevent redundant parallel requests
const inflightGetRequests = new Map();

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Deduplicate identical simultaneous GET requests
  if (config.method === 'get' && !config._skipDedup) {
    const dedupKey = `${config.url || ''}?${JSON.stringify(config.params || {})}`
    if (inflightGetRequests.has(dedupKey)) {
      config.adapter = () => inflightGetRequests.get(dedupKey)
    }
  }

  return config
})

const API_CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes
const API_CACHE_MAX_ENTRIES = 200

/** Only these mutation prefixes may be queued while offline (POS / sales ops). */
const OFFLINE_MUTATION_ALLOWLIST = [
  '/invoices',
  '/customers',
  '/quotations',
  '/delivery-notes',
  '/purchase-orders',
  '/expenses',
  '/bakala',
  '/bookstore',
  '/pos',
]

const isOfflineMutationAllowed = (url = '') => {
  const path = String(url).split('?')[0]
  if (path.includes('/auth/') || path.includes('/zatca') || path.includes('/accounting') || path.includes('/webhooks')) {
    return false
  }
  return OFFLINE_MUTATION_ALLOWLIST.some((prefix) => path.includes(prefix))
}

// Asynchronous non-blocking background cache write (0ms latency penalty on requests)
const backgroundCacheResponse = (config, data) => {
  if (!config || config.method !== 'get' || config.url?.includes('/auth/')) return
  setTimeout(async () => {
    try {
      const db = await initDb()
      if (!db) return
      const cacheKey = config.url + (config.params ? JSON.stringify(config.params) : '')
      await db.put('api_cache', {
        url: cacheKey,
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + API_CACHE_TTL_MS,
      })
      // Bound cache size — drop oldest entries when over cap
      const all = await db.getAll('api_cache')
      if (Array.isArray(all) && all.length > API_CACHE_MAX_ENTRIES) {
        const sorted = [...all].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        const excess = sorted.slice(0, all.length - API_CACHE_MAX_ENTRIES)
        await Promise.all(excess.map((row) => db.delete('api_cache', row.url).catch(() => {})))
      }
    } catch (err) {
      // Silently catch background caching errors
    }
  }, 0)
}

api.interceptors.response.use(
  (response) => {
    // Clear deduplication cache entry
    if (response.config?.method === 'get') {
      const dedupKey = `${response.config.url || ''}?${JSON.stringify(response.config.params || {})}`
      inflightGetRequests.delete(dedupKey)
    }
    backgroundCacheResponse(response.config, response.data)
    return response
  },
  async (error) => {
    const config = error.config;
    if (config?.method === 'get') {
      const dedupKey = `${config.url || ''}?${JSON.stringify(config.params || {})}`
      inflightGetRequests.delete(dedupKey)
    }

    const isNetworkError = !error.response || !navigator.onLine;
    
    if (isNetworkError && config) {
      // 1. If it's a GET request, attempt to retrieve the cached response
      if (config.method === 'get') {
        try {
          const db = await initDb();
          if (!db) return Promise.reject(error);
          const cacheKey = config.url + (config.params ? JSON.stringify(config.params) : '');
          const cached = await db.get('api_cache', cacheKey);
          const isFresh = cached && (!cached.expiresAt || cached.expiresAt > Date.now())
            && (Date.now() - (cached.timestamp || 0) < API_CACHE_TTL_MS);

          if (cached && !isFresh) {
            try { await db.delete('api_cache', cacheKey) } catch { /* ignore */ }
          }

          let responseData = isFresh ? cached.data : null;
          
          // --- OFFLINE MERGE FOR LISTS ---
          const pendingItems = await db.getAll('sync_queue');
          
          const mergeQueue = (entityName, typeMatches) => {
            const newItems = pendingItems
              .filter(item => item.status === 'PENDING' && typeMatches.some(t => item.type.includes(t)))
              .map(item => ({ ...item.payload, _id: item.id, offline: true, createdAt: item.createdAt }));
              
            if (responseData && Array.isArray(responseData[entityName])) {
              responseData = { ...responseData, [entityName]: [...newItems, ...responseData[entityName]] };
            } else if (Array.isArray(responseData)) {
              responseData = [...newItems, ...responseData];
            } else if (!responseData && entityName) {
              responseData = { [entityName]: newItems, totalPages: 1, currentPage: 1 };
            } else if (!responseData) {
              responseData = newItems;
            }
          };

          if (config.url.includes('/invoices') && !config.url.includes('/invoices/')) {
            mergeQueue('invoices', ['/invoices/sell', '/invoices/purchase', 'POST:/invoices']);
          } else if (config.url.includes('/customers') && !config.url.includes('/customers/')) {
            mergeQueue('customers', ['POST:/customers']);
          } else if (config.url.includes('/quotations') && !config.url.includes('/quotations/')) {
            mergeQueue('quotations', ['POST:/quotations']);
          } else if (config.url.includes('/delivery-notes') && !config.url.includes('/delivery-notes/')) {
            mergeQueue('deliveryNotes', ['POST:/delivery-notes']);
          } else if (config.url.includes('/purchase-orders') && !config.url.includes('/purchase-orders/')) {
            mergeQueue('purchaseOrders', ['POST:/purchase-orders']);
          } else if (config.url.includes('/contacts') && !config.url.includes('/contacts/')) {
            mergeQueue('contacts', ['POST:/contacts']);
          } else if (config.url.includes('/projects') && !config.url.includes('/projects/')) {
            mergeQueue('projects', ['POST:/projects']);
          } else if (config.url.includes('/expenses') && !config.url.includes('/expenses/')) {
            mergeQueue('expenses', ['POST:/expenses']);
          }

          if (responseData) {
            console.log(`[Offline-Cache] Serving cached/merged data for ${cacheKey}`);
            return Promise.resolve({
              data: responseData,
              status: 200,
              statusText: 'OK (Cached)',
              headers: {},
              config
            });
          }
        } catch (e) {
          console.error('Failed to read GET request cache:', e);
        }
      }

      // 2. If it's a mutation request, queue it for background syncing
      const isMutation = ['post', 'put', 'delete'].includes(config.method);
      const requestUrl = String(config.url || '');
      const isAuthRequest = requestUrl.includes('/auth/login') ||
                            requestUrl.includes('/auth/me') ||
                            requestUrl.includes('/public/demo-login') ||
                            requestUrl.includes('/auth/register') ||
                            requestUrl.includes('/auth/handoff');
      const isScrapeRequest = requestUrl.includes('/leads/scrape');

      const skipOffline = config.headers && config.headers['X-Skip-Offline-Queue'];

      if (isMutation && !isAuthRequest && !isScrapeRequest && !skipOffline && isOfflineMutationAllowed(requestUrl)) {
        try {
          const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
          const syncId = await enqueueSyncItem(`${config.method.toUpperCase()}:${config.url}`, {
            url: config.url,
            method: config.method,
            data: payload,
            headers: config.headers
          });

          console.log(`[Offline-Queue] Queued mutation: ${config.method.toUpperCase()} ${config.url}`);
          return Promise.resolve({
            data: { success: true, offline: true, id: syncId, message: 'Saved offline and queued for sync.' },
            status: 202,
            statusText: 'Accepted Offline',
            headers: {},
            config
          });
        } catch (e) {
          console.error('Failed to queue offline mutation:', e);
        }
      }
    }

    error.userMessage = getApiErrorMessage(error)

    // ── 429 Rate-limit: exponential backoff retry with randomized jitter (up to 5 attempts) ──
    if (error.response?.status === 429 && config) {
      config._429RetryCount = (config._429RetryCount || 0) + 1
      if (config._429RetryCount <= 5) {
        const retryAfterHeader = parseInt(error.response.headers?.['retry-after'] || '0', 10)
        const jitter = Math.floor(Math.random() * 400) + 100
        const backoffMs = retryAfterHeader > 0
          ? (retryAfterHeader * 1000) + jitter
          : Math.min(400 * Math.pow(1.8, config._429RetryCount) + jitter, 12000)
        console.warn(`[API] 429 Rate Limit encountered – retrying in ${backoffMs}ms with jitter (attempt ${config._429RetryCount}/5) for ${config.url}`)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
        config._skipDedup = true
        config.timeout = Math.max(config.timeout || 45000, 30000)
        return api(config)
      }

      // If a GET request exhausted 429 retries, gracefully fallback to cached response if available
      if (config.method === 'get') {
        try {
          const db = await initDb()
          if (db) {
            const cacheKey = config.url + (config.params ? JSON.stringify(config.params) : '')
            const cached = await db.get('api_cache', cacheKey)
            if (cached?.data) {
              console.warn(`[API] Serving cached fallback after 429 for ${config.url}`)
              return Promise.resolve({
                data: cached.data,
                status: 200,
                statusText: 'OK (Cached Fallback)',
                headers: {},
                config,
              })
            }
          }
        } catch {
          // ignore cache read error
        }
      }
    }

    // Trial limit reached — dispatch event for TrialLimitModal
    if (error.response?.status === 403 && error.response?.data?.error === 'TRIAL_LIMIT_REACHED') {
      window.dispatchEvent(new CustomEvent('trial-limit-reached', {
        detail: error.response.data,
      }))
    }

    const requestUrl = String(error.config?.url || '')
    // Requests that handle their own 401 logic — don't intercept these.
    const isAuthManagedRequest = requestUrl.includes('/auth/login')
      || requestUrl.includes('/auth/me')
      || requestUrl.includes('/public/demo-login')
      || requestUrl.includes('/auth/register')

    if (error.response?.status === 401 && !isAuthManagedRequest) {
      const errMsg = error.response?.data?.error || ''
      if (errMsg === 'Tenant account is inactive') {
        window.dispatchEvent(new CustomEvent('tenant-inactive'))
      } else {
        localStorage.removeItem('token')
        localStorage.removeItem('auth_user')
        localStorage.removeItem('auth_tenant')
        window.dispatchEvent(new CustomEvent('auth-expired'))
      }
    }

    return Promise.reject(error)
  }
)

export default api
