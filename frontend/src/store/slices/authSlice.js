import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'
import {
  clearAuthSession,
  getAuthToken,
  getCachedAuthTenant,
  getCachedAuthUser,
  persistAuthSession,
  setRememberedEmail,
} from '../../lib/authStorage'

const hasBusinessIdentity = (business) => Boolean(
  business?.legalNameEn
  || business?.legalNameAr
  || business?.vatNumber
  || business?.crNumber
  || business?.contactEmail
  || business?.tradeName
)

/** True when someone passed the whole `/auth/me` body as if it were a tenant. */
const looksLikeAuthMePayload = (value) => Boolean(
  value
  && typeof value === 'object'
  && value.user
  && value.tenant
  && !value.business
  && !value.businessTypes
  && !value.name
)

/**
 * Merge tenant updates instead of replacing. Callers often dispatch partial
 * patches (compliance keys only) or the full `/auth/me` envelope by mistake;
 * a full replace wiped company profile fields for every tenant.
 */
const mergeTenantState = (prev, incoming) => {
  if (!incoming || typeof incoming !== 'object') return prev || null

  let patch = incoming
  if (looksLikeAuthMePayload(incoming)) {
    patch = incoming.tenant
  }
  if (!patch || typeof patch !== 'object') return prev || null
  if (!prev) return patch

  const next = {
    ...prev,
    ...patch,
    settings: patch.settings
      ? {
          ...(prev.settings || {}),
          ...patch.settings,
          invoiceBranding: patch.settings.invoiceBranding
            ? {
                ...(prev.settings?.invoiceBranding || {}),
                ...patch.settings.invoiceBranding,
              }
            : prev.settings?.invoiceBranding,
        }
      : prev.settings,
    branding: patch.branding
      ? { ...(prev.branding || {}), ...patch.branding }
      : prev.branding,
    subscription: patch.subscription || prev.subscription,
  }

  if (patch.business || prev.business) {
    if (hasBusinessIdentity(patch.business)) {
      next.business = { ...(prev.business || {}), ...patch.business }
    } else if (prev.business) {
      next.business = { ...prev.business, ...(patch.business || {}) }
    } else {
      next.business = patch.business
    }
  }

  if (!patch.name && prev.name) next.name = prev.name
  if (!patch.businessTypes && prev.businessTypes) next.businessTypes = prev.businessTypes
  if (!patch.businessType && prev.businessType) next.businessType = prev.businessType
  if (!patch._id && prev._id) next._id = prev._id
  if (!patch.slug && prev.slug) next.slug = prev.slug

  return next
}

const persistAuthSnapshot = (payload = {}) => {
  persistAuthSession({
    user: Object.prototype.hasOwnProperty.call(payload, 'user') ? payload.user : undefined,
    tenant: Object.prototype.hasOwnProperty.call(payload, 'tenant') ? payload.tenant : undefined,
    remember: payload.remember,
  })
}

const clearAuthSnapshot = () => {
  clearAuthSession()
}

const token = getAuthToken()
const cachedUser = getCachedAuthUser()
const cachedTenant = (() => {
  try {
    const raw = getCachedAuthTenant()
    if (!raw || typeof raw !== 'object') return null
    // Recover from a past bug that stored the whole `/auth/me` envelope as tenant.
    if (looksLikeAuthMePayload(raw) && raw.tenant) {
      persistAuthSession({ tenant: raw.tenant })
      return raw.tenant
    }
    // Discard shells that only hold a compliance key (no company identity).
    if (!raw._id && !raw.name && !raw.business && !raw.businessTypes && !raw.subscription) {
      persistAuthSession({ tenant: null })
      return null
    }
    return raw
  } catch {
    return null
  }
})()

const initialState = {
  user: cachedUser,
  tenant: cachedTenant,
  token,
  isAuthenticated: !!token && !!cachedUser,
  isLoading: !!token && !cachedUser,
  error: null,
}

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password, tenantSlug, rememberMe }, { rejectWithValue }) => {
    try {
      // Obfuscate password to prevent it showing in plaintext in the Network tab
      // Note: HTTPS provides the actual transport security.
      const remember = Boolean(rememberMe)
      const obfPassword = btoa(encodeURIComponent(password))
      const { data } = await api.post('/auth/login', { 
        email, 
        password: obfPassword, 
        isObfuscated: true,
        tenantSlug,
        rememberMe: remember,
      })
      persistAuthSession({
        token: data.token,
        user: data.user,
        tenant: data.tenant,
        remember,
      })
      setRememberedEmail(email, remember)
      return data
    } catch (error) {
      return rejectWithValue(error.userMessage || error.response?.data?.error || 'Login failed')
    }
  }
)

export const demoLogin = createAsyncThunk('auth/demoLogin', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/public/demo-login')
    persistAuthSession({ token: data.token, user: data.user, tenant: data.tenant, remember: true })
    persistAuthSnapshot(data)
    return data
  } catch (error) {
    return rejectWithValue(error.userMessage || error.response?.data?.error || 'Demo login failed')
  }
})

export const demoSignup = createAsyncThunk('auth/demoSignup', async ({ email, businessType, country, currency, companyName, logo }, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/public/demo-signup', { email, businessType, country, currency, companyName, logo })
    persistAuthSession({ token: data.token, user: data.user, tenant: data.tenant, remember: true })
    persistAuthSnapshot(data)
    return data
  } catch (error) {
    return rejectWithValue(error.userMessage || error.response?.data?.error || 'Demo signup failed')
  }
})

export const getMe = createAsyncThunk(
  'auth/getMe',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/auth/me')
      persistAuthSnapshot(data)
      return data
    } catch (error) {
      const errMsg = error.response?.data?.error || ''
      // If tenant is inactive, keep the token — don't log out
      // The InactiveBlocker in MainLayout will show based on tenant.isActive
      if (errMsg === 'Tenant account is inactive') {
        return rejectWithValue({ tenantInactive: true })
      }
      clearAuthSnapshot()
      return rejectWithValue(error.userMessage || errMsg || 'Session expired')
    }
  }
)

export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    await api.post('/auth/logout')
  } catch {
    // Cookie clear is best-effort — always clear local session
  }
  clearAuthSnapshot()
  return null
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    updateUser: (state, action) => {
      state.user = { ...state.user, ...action.payload }
      persistAuthSnapshot({ user: state.user, tenant: state.tenant })
    },
    updateTenant: (state, action) => {
      state.tenant = mergeTenantState(state.tenant, action.payload)
      persistAuthSnapshot({ user: state.user, tenant: state.tenant })
    },
    setTenantInactive: (state) => {
      if (state.tenant) {
        state.tenant = { ...state.tenant, isActive: false }
        persistAuthSnapshot({ user: state.user, tenant: state.tenant })
      }
    },
    // Seed token into Redux + localStorage (cross-subdomain handoff).
    // Without this, getMe can succeed via the axios interceptor while
    // state.token stays null → AuthLayout ↔ ProtectedRoute navigation loop.
    seedSessionToken: (state, action) => {
      const next = String(action.payload || '').trim()
      if (!next) return
      state.token = next
      state.isLoading = true
      state.error = null
      persistAuthSession({ token: next, remember: true })
    },
    // Synchronous logout — used by the auth-expired event handler so that
    // Redux state is cleared BEFORE React Router navigates to /login.
    // The async logout() thunk is too slow: isAuthenticated stays true
    // long enough for AuthLayout to redirect back to /app/dashboard.
    forceLogout: (state) => {
      state.isAuthenticated = false
      state.isLoading = false
      state.user = null
      state.tenant = null
      state.token = null
      state.error = null
      try {
        clearAuthSession()
      } catch {}
      // Best-effort clear httpOnly cookie (fire-and-forget; reducer must stay sync)
      try {
        api.post('/auth/logout').catch(() => {})
      } catch {}
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false
        state.isAuthenticated = true
        state.user = action.payload.user
        state.tenant = action.payload.tenant
        state.token = action.payload.token
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      .addCase(demoLogin.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(demoLogin.fulfilled, (state, action) => {
        state.isLoading = false
        state.isAuthenticated = true
        state.user = action.payload.user
        state.tenant = action.payload.tenant
        state.token = action.payload.token
      })
      .addCase(demoLogin.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      .addCase(demoSignup.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(demoSignup.fulfilled, (state, action) => {
        state.isLoading = false
        state.isAuthenticated = true
        state.user = action.payload.user
        state.tenant = action.payload.tenant
        state.token = action.payload.token
      })
      .addCase(demoSignup.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
      .addCase(getMe.pending, (state) => {
        if (!state.isAuthenticated) {
          state.isLoading = true
        }
      })
      .addCase(getMe.fulfilled, (state, action) => {
        state.isLoading = false
        state.isAuthenticated = true
        state.user = action.payload.user
        // Keep Redux token in sync after handoff (token may only exist in localStorage).
        if (!state.token) {
          try {
            state.token = getAuthToken()
          } catch {
            state.token = null
          }
        }
        if (action.payload.tenant) {
          state.tenant = action.payload.tenant
        } else if (action.payload.user?.role !== 'super_admin') {
          state.tenant = null
        }
      })
      .addCase(getMe.rejected, (state, action) => {
        state.isLoading = false
        // If tenant-inactive, keep user authenticated — InactiveBlocker handles it
        if (action.payload?.tenantInactive) {
          if (state.tenant) state.tenant = { ...state.tenant, isActive: false }
          return
        }
        state.isAuthenticated = false
        state.user = null
        state.tenant = null
        state.token = null
      })
      .addCase(logout.fulfilled, (state) => {
        state.isAuthenticated = false
        state.user = null
        state.tenant = null
        state.token = null
      })
  },
})

export const { clearError, updateUser, updateTenant, setTenantInactive, forceLogout, seedSessionToken } = authSlice.actions
export default authSlice.reducer
