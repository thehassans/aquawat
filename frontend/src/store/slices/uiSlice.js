import { createSlice } from '@reduxjs/toolkit'

const getInitialLanguage = () => {
  const saved = localStorage.getItem('language')
  return saved || 'en'
}

const getInitialTheme = () => {
  const saved = localStorage.getItem('theme')
  if (saved) return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const getInitialHideSidebar = () => {
  const saved = localStorage.getItem('hideSidebar')
  return saved === 'true'
}

const getInitialHiddenMenuItems = () => {
  try {
    const saved = localStorage.getItem('hiddenMenuItems')
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

const getHiddenMenuItemsForTenant = (tenantId) => {
  if (!tenantId) return []
  try {
    const all = localStorage.getItem('hiddenMenuItemsByTenant')
    const map = all ? JSON.parse(all) : {}
    return Array.isArray(map[tenantId]) ? map[tenantId] : []
  } catch {
    return []
  }
}

const setHiddenMenuItemsForTenantStorage = (tenantId, items) => {
  if (!tenantId) return
  try {
    const all = localStorage.getItem('hiddenMenuItemsByTenant')
    const map = all ? JSON.parse(all) : {}
    map[tenantId] = Array.isArray(items) ? items : []
    localStorage.setItem('hiddenMenuItemsByTenant', JSON.stringify(map))
  } catch {
    // ignore
  }
}

const getDisplayModeForTenant = (tenantId) => {
  if (!tenantId) return 'auto'
  try {
    const all = localStorage.getItem('displayModeByTenant')
    const map = all ? JSON.parse(all) : {}
    return ['auto', 'desktop', 'tablet'].includes(map[tenantId]) ? map[tenantId] : 'auto'
  } catch {
    return 'auto'
  }
}

const getNavigationStyleForTenant = (tenantId) => {
  if (!tenantId) return 'sidebar'
  try {
    const all = localStorage.getItem('navigationStyleByTenant')
    const map = all ? JSON.parse(all) : {}
    return ['sidebar', 'launcher'].includes(map[tenantId]) ? map[tenantId] : 'sidebar'
  } catch {
    return 'sidebar'
  }
}

const setDisplayModeForTenantStorage = (tenantId, mode) => {
  if (!tenantId) return
  try {
    const all = localStorage.getItem('displayModeByTenant')
    const map = all ? JSON.parse(all) : {}
    map[tenantId] = ['auto', 'desktop', 'tablet'].includes(mode) ? mode : 'auto'
    localStorage.setItem('displayModeByTenant', JSON.stringify(map))
  } catch {
    // ignore
  }
}

const setNavigationStyleForTenantStorage = (tenantId, style) => {
  if (!tenantId) return
  try {
    const all = localStorage.getItem('navigationStyleByTenant')
    const map = all ? JSON.parse(all) : {}
    map[tenantId] = ['sidebar', 'launcher'].includes(style) ? style : 'sidebar'
    localStorage.setItem('navigationStyleByTenant', JSON.stringify(map))
  } catch {
    // ignore
  }
}

const applyDisplayMode = (mode) => {
  const html = document.documentElement
  html.classList.remove('display-mode-auto', 'display-mode-tablet', 'display-mode-desktop')
  if (mode === 'tablet' || mode === 'desktop') {
    html.classList.add(`display-mode-${mode}`)
  }
}

const initialState = {
  language: getInitialLanguage(),
  theme: getInitialTheme(),
  sidebarOpen: true,
  sidebarCollapsed: false,
  hideSidebar: getInitialHideSidebar(),
  hiddenMenuItems: getInitialHiddenMenuItems(),
  displayMode: 'auto',
  navigationStyle: 'sidebar',
  mobileMenuOpen: false,
  appLauncherOpen: false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLanguage: (state, action) => {
      state.language = action.payload
      localStorage.setItem('language', action.payload)
      document.documentElement.dir = action.payload === 'ar' ? 'rtl' : 'ltr'
      document.documentElement.lang = action.payload
    },
    setTheme: (state, action) => {
      state.theme = action.payload
      localStorage.setItem('theme', action.payload)
      if (action.payload === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen
    },
    toggleSidebarCollapse: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
    setMobileMenuOpen: (state, action) => {
      state.mobileMenuOpen = action.payload
    },
    setAppLauncherOpen: (state, action) => {
      state.appLauncherOpen = action.payload
    },
    setHideSidebar: (state, action) => {
      state.hideSidebar = action.payload
      localStorage.setItem('hideSidebar', String(action.payload))
    },
    toggleHideSidebar: (state) => {
      state.hideSidebar = !state.hideSidebar
      localStorage.setItem('hideSidebar', String(state.hideSidebar))
    },
    setHiddenMenuItems: (state, action) => {
      state.hiddenMenuItems = Array.isArray(action.payload) ? action.payload : []
      localStorage.setItem('hiddenMenuItems', JSON.stringify(state.hiddenMenuItems))
    },
    toggleHiddenMenuItem: (state, action) => {
      const path = action.payload
      const current = new Set(state.hiddenMenuItems || [])
      if (current.has(path)) {
        current.delete(path)
      } else {
        current.add(path)
      }
      state.hiddenMenuItems = Array.from(current)
      localStorage.setItem('hiddenMenuItems', JSON.stringify(state.hiddenMenuItems))
    },
    loadHiddenMenuItemsForTenant: (state, action) => {
      const tenantId = action.payload
      state.hiddenMenuItems = getHiddenMenuItemsForTenant(tenantId)
    },
    setHiddenMenuItemsForTenant: (state, action) => {
      const { tenantId, items } = action.payload || {}
      state.hiddenMenuItems = Array.isArray(items) ? items : []
      setHiddenMenuItemsForTenantStorage(tenantId, state.hiddenMenuItems)
    },
    toggleHiddenMenuItemForTenant: (state, action) => {
      const { tenantId, path } = action.payload || {}
      const current = new Set(state.hiddenMenuItems || [])
      if (current.has(path)) {
        current.delete(path)
      } else {
        current.add(path)
      }
      state.hiddenMenuItems = Array.from(current)
      setHiddenMenuItemsForTenantStorage(tenantId, state.hiddenMenuItems)
    },
    setDisplayMode: (state, action) => {
      let tenantId, mode
      if (typeof action.payload === 'string') {
        mode = action.payload
      } else {
        tenantId = action.payload?.tenantId
        mode = action.payload?.mode
      }
      mode = ['auto', 'desktop', 'tablet'].includes(mode) ? mode : 'auto'
      state.displayMode = mode
      if (tenantId) setDisplayModeForTenantStorage(tenantId, mode)
      else localStorage.setItem('displayMode', mode)
      applyDisplayMode(mode)
    },
    loadDisplayModeForTenant: (state, action) => {
      const tenantId = action.payload
      const mode = getDisplayModeForTenant(tenantId)
      state.displayMode = mode
      applyDisplayMode(mode)
    },
    setNavigationStyle: (state, action) => {
      const { tenantId, style } = action.payload
      state.navigationStyle = style
      setNavigationStyleForTenantStorage(tenantId, style)
    },
    loadNavigationStyleForTenant: (state, action) => {
      const tenantId = action.payload
      state.navigationStyle = getNavigationStyleForTenant(tenantId)
    },
  },
})

export const { setLanguage, setTheme, toggleSidebar, toggleSidebarCollapse, setMobileMenuOpen, setAppLauncherOpen, setHideSidebar, toggleHideSidebar, setHiddenMenuItems, toggleHiddenMenuItem, loadHiddenMenuItemsForTenant, setHiddenMenuItemsForTenant, toggleHiddenMenuItemForTenant, setDisplayMode, loadDisplayModeForTenant, setNavigationStyle, loadNavigationStyleForTenant } = uiSlice.actions
export default uiSlice.reducer
