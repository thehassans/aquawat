/**
 * Recent apps — tenant-scoped local history for the header app-grid dropdown.
 */

const MAX_RECENT = 8
const STORAGE_PREFIX = 'maqder:recent-apps:'

const DEFAULT_SEED = [
  { path: '/app/dashboard', labelEn: 'Dashboard', labelAr: 'لوحة التحكم' },
  { path: '/app/dashboard/sales', labelEn: 'Sales', labelAr: 'المبيعات' },
  { path: '/app/dashboard/purchases', labelEn: 'Purchases', labelAr: 'المشتريات' },
  { path: '/app/dashboard/inventory', labelEn: 'Inventory', labelAr: 'المخزون' },
  { path: '/app/dashboard/accounting', labelEn: 'Accounting', labelAr: 'المحاسبة' },
]

const PATH_LABELS = {
  '/app/dashboard': { labelEn: 'Dashboard', labelAr: 'لوحة التحكم' },
  '/app/dashboard/sales': { labelEn: 'Sales', labelAr: 'المبيعات' },
  '/app/dashboard/purchases': { labelEn: 'Purchases', labelAr: 'المشتريات' },
  '/app/dashboard/inventory': { labelEn: 'Inventory', labelAr: 'المخزون' },
  '/app/dashboard/accounting': { labelEn: 'Accounting', labelAr: 'المحاسبة' },
  '/app/dashboard/customers': { labelEn: 'Customers', labelAr: 'العملاء' },
  '/app/dashboard/suppliers': { labelEn: 'Vendors', labelAr: 'الموردون' },
  '/app/dashboard/crm': { labelEn: 'CRM', labelAr: 'إدارة العملاء' },
  '/app/dashboard/finance': { labelEn: 'Finance', labelAr: 'المالية' },
  '/app/dashboard/app-store': { labelEn: 'App Store', labelAr: 'متجر التطبيقات' },
  '/app/dashboard/settings': { labelEn: 'Settings', labelAr: 'الإعدادات' },
  '/app/dashboard/profile': { labelEn: 'Profile', labelAr: 'الملف' },
  '/app/dashboard/reports': { labelEn: 'Reports', labelAr: 'التقارير' },
  '/app/dashboard/employees': { labelEn: 'Employees', labelAr: 'الموظفون' },
  '/app/dashboard/pos': { labelEn: 'POS', labelAr: 'نقطة البيع' },
  '/app/dashboard/restaurant': { labelEn: 'Restaurant', labelAr: 'مطعم' },
  '/app/dashboard/manufacturing': { labelEn: 'Manufacturing', labelAr: 'التصنيع' },
  '/app/dashboard/projects': { labelEn: 'Projects', labelAr: 'المشاريع' },
  '/app/dashboard/contacts': { labelEn: 'Contacts', labelAr: 'جهات الاتصال' },
}

function storageKey(tenantId) {
  return `${STORAGE_PREFIX}${tenantId || 'anon'}`
}

/** Collapse deep routes to a stable app root for the launcher. */
export function canonicalizeAppPath(pathname = '') {
  const raw = String(pathname || '').split('?')[0]
  const parts = raw.split('/').filter(Boolean)
  if (parts[0] !== 'app' || parts[1] !== 'dashboard') return raw || '/app/dashboard'
  if (parts.length <= 2) return '/app/dashboard'

  const root = parts[2]
  if (root === 'tenant-settings' && parts[3]) {
    return `/app/dashboard/tenant-settings/${parts[3]}`
  }
  if (root === 'gym') return '/app/dashboard/gym/dashboard'
  if (root === 'marquee') return '/app/dashboard/marquee'
  return `/app/dashboard/${root}`
}

export function labelForAppPath(path, language = 'en') {
  const known = PATH_LABELS[path]
  if (known) return language === 'ar' ? known.labelAr : known.labelEn
  const slug = String(path || '').split('/').filter(Boolean).pop() || 'App'
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function readRaw(tenantId) {
  try {
    const raw = localStorage.getItem(storageKey(tenantId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRaw(tenantId, rows) {
  try {
    localStorage.setItem(storageKey(tenantId), JSON.stringify(rows.slice(0, MAX_RECENT)))
  } catch {
    /* ignore quota */
  }
}

export function getRecentApps(tenantId, { language = 'en', limit = MAX_RECENT } = {}) {
  const rows = readRaw(tenantId)
    .filter((row) => row?.path)
    .map((row) => ({
      path: canonicalizeAppPath(row.path),
      labelEn: row.labelEn || PATH_LABELS[canonicalizeAppPath(row.path)]?.labelEn || labelForAppPath(row.path, 'en'),
      labelAr: row.labelAr || PATH_LABELS[canonicalizeAppPath(row.path)]?.labelAr || labelForAppPath(row.path, 'ar'),
      visitedAt: Number(row.visitedAt) || 0,
    }))

  const deduped = []
  const seen = new Set()
  for (const row of rows) {
    if (seen.has(row.path)) continue
    seen.add(row.path)
    deduped.push(row)
  }

  if (!deduped.length) {
    return DEFAULT_SEED.slice(0, limit).map((row) => ({
      ...row,
      visitedAt: 0,
      isSeed: true,
    }))
  }

  return deduped.slice(0, limit)
}

export function pushRecentApp(tenantId, { path, labelEn, labelAr } = {}) {
  const canonical = canonicalizeAppPath(path)
  if (!canonical || !canonical.startsWith('/app/dashboard')) return getRecentApps(tenantId)

  const known = PATH_LABELS[canonical]
  const next = {
    path: canonical,
    labelEn: labelEn || known?.labelEn || labelForAppPath(canonical, 'en'),
    labelAr: labelAr || known?.labelAr || labelForAppPath(canonical, 'ar'),
    visitedAt: Date.now(),
  }

  const prev = readRaw(tenantId).filter((row) => canonicalizeAppPath(row.path) !== canonical)
  writeRaw(tenantId, [next, ...prev])
  return getRecentApps(tenantId)
}
