import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

const token = localStorage.getItem('token')
const cachedUser = (() => {
  try {
    return JSON.parse(localStorage.getItem('auth_user') || 'null')
  } catch {
    return null
  }
})()
const cachedTenant = (() => {
  try {
    return JSON.parse(localStorage.getItem('auth_tenant') || 'null')
  } catch {
    return null
  }
})()

const persistAuthSnapshot = (payload = {}) => {
  if (Object.prototype.hasOwnProperty.call(payload, 'user')) {
    if (payload.user) {
      localStorage.setItem('auth_user', JSON.stringify(payload.user))
    } else {
      localStorage.removeItem('auth_user')
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'tenant')) {
    if (payload.tenant) {
      localStorage.setItem('auth_tenant', JSON.stringify(payload.tenant))
    } else {
      localStorage.removeItem('auth_tenant')
    }
  }
}

const clearAuthSnapshot = () => {
  localStorage.removeItem('auth_user')
  localStorage.removeItem('auth_tenant')
}

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
  async ({ email, password, tenantSlug }, { rejectWithValue }) => {
    try {
      // Obfuscate password to prevent it showing in plaintext in the Network tab
      // Note: HTTPS provides the actual transport security.
      const obfPassword = btoa(encodeURIComponent(password))
      const { data } = await api.post('/auth/login', { 
        email, 
        password: obfPassword, 
        isObfuscated: true,
        tenantSlug 
      })
      localStorage.setItem('token', data.token)
      persistAuthSnapshot(data)
      return data
    } catch (error) {
      return rejectWithValue(error.userMessage || error.response?.data?.error || 'Login failed')
    }
  }
)

export const demoLogin = createAsyncThunk('auth/demoLogin', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/public/demo-login')
    localStorage.setItem('token', data.token)
    persistAuthSnapshot(data)
    return data
  } catch (error) {
    return rejectWithValue(error.userMessage || error.response?.data?.error || 'Demo login failed')
  }
})

export const demoSignup = createAsyncThunk('auth/demoSignup', async ({ email, businessType }, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/public/demo-signup', { email, businessType })
    localStorage.setItem('token', data.token)
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
      localStorage.removeItem('token')
      clearAuthSnapshot()
      return rejectWithValue(error.userMessage || errMsg || 'Session expired')
    }
  }
)

export const logout = createAsyncThunk('auth/logout', async () => {
  localStorage.removeItem('token')
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
      state.tenant = action.payload
      persistAuthSnapshot({ user: state.user, tenant: state.tenant })
    },
    setTenantInactive: (state) => {
      if (state.tenant) {
        state.tenant = { ...state.tenant, isActive: false }
        try { localStorage.setItem('auth_tenant', JSON.stringify(state.tenant)) } catch {}
      }
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

export const { clearError, updateUser, updateTenant, setTenantInactive, forceLogout } = authSlice.actions
export default authSlice.reducer
