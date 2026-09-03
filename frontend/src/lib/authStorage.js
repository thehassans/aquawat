const TOKEN_KEY = 'token'
const USER_KEY = 'auth_user'
const TENANT_KEY = 'auth_tenant'
const REMEMBER_FLAG = 'auth_remember'
const REMEMBERED_EMAIL_KEY = 'maqder_remembered_email'

const parseJson = (raw) => {
  try {
    return JSON.parse(raw || 'null')
  } catch {
    return null
  }
}

const readFromStores = (key) => localStorage.getItem(key) || sessionStorage.getItem(key)

export const isRememberedSession = () => {
  const flag = localStorage.getItem(REMEMBER_FLAG)
  if (flag === '0') return false
  if (flag === '1') return true
  return Boolean(localStorage.getItem(TOKEN_KEY))
}

export const getAuthToken = () => readFromStores(TOKEN_KEY)

export const getCachedAuthUser = () => parseJson(readFromStores(USER_KEY))

export const getCachedAuthTenant = () => parseJson(readFromStores(TENANT_KEY))

export const getRememberedEmail = () => String(localStorage.getItem(REMEMBERED_EMAIL_KEY) || '').trim()

export const setRememberedEmail = (email, remember) => {
  const value = String(email || '').trim()
  if (remember && value) localStorage.setItem(REMEMBERED_EMAIL_KEY, value)
  else localStorage.removeItem(REMEMBERED_EMAIL_KEY)
}

const writeStore = (store, key, value) => {
  if (value == null || value === '') store.removeItem(key)
  else store.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
}

export const persistAuthSession = ({ token, user, tenant, remember } = {}) => {
  const keep = remember == null ? isRememberedSession() : Boolean(remember)
  const persist = keep ? localStorage : sessionStorage
  const other = keep ? sessionStorage : localStorage

  ;[TOKEN_KEY, USER_KEY, TENANT_KEY].forEach((key) => other.removeItem(key))

  if (token !== undefined) writeStore(persist, TOKEN_KEY, token || '')
  if (user !== undefined) writeStore(persist, USER_KEY, user || '')
  if (tenant !== undefined) writeStore(persist, TENANT_KEY, tenant || '')

  if (keep) localStorage.setItem(REMEMBER_FLAG, '1')
  else localStorage.setItem(REMEMBER_FLAG, '0')
}

export const clearAuthSession = () => {
  ;[localStorage, sessionStorage].forEach((store) => {
    store.removeItem(TOKEN_KEY)
    store.removeItem(USER_KEY)
    store.removeItem(TENANT_KEY)
  })
  localStorage.removeItem(REMEMBER_FLAG)
}
