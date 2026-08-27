import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ArrowLeft, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { asInvList } from '../../../lib/invList'
import { formatInvError } from '../../../lib/invError'
import AsyncCombobox from '../../../components/ui/AsyncCombobox'
import { isFullInventoryAccounting } from '../../../lib/inventoryAccountingMode'

const USAGE_OPTIONS = [
  { value: 'view', en: 'View', ar: 'عرض' },
  { value: 'internal', en: 'Internal Location', ar: 'موقع داخلي' },
  { value: 'customer', en: 'Customer Location', ar: 'موقع العميل' },
  { value: 'vendor', en: 'Vendor Location', ar: 'موقع المورد' },
  { value: 'inventoryLoss', en: 'Inventory Loss', ar: 'فاقد المخزون' },
  { value: 'production', en: 'Production', ar: 'الإنتاج' },
  { value: 'transit', en: 'Transit Location', ar: 'موقع العبور' },
]

const categoryAccountLabel = (row, language) => {
  if (!row) return '—'
  const name = language === 'ar' ? (row.nameAr || row.name) : row.name
  return row.code ? `${row.code} · ${name}` : name
}

/**
 * Dedicated location configuration form (master-detail routing).
 */
export default function LocationForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    nameAr: '',
    parentId: '',
    usage: 'internal',
    warehouseId: '',
    isScrapLocation: false,
    isReturnLocation: false,
    stockValuationAccountId: '',
    stockInputAccountId: '',
    stockOutputAccountId: '',
    barcode: '',
    active: true,
  })
  const [parentOption, setParentOption] = useState(null)

  const { data: existing } = useQuery({
    queryKey: ['inv-location', id],
    queryFn: () => api.get(`/stock/locations/${id}`).then((r) => r.data),
    enabled: isEdit,
  })

  const { data: allLocations } = useQuery({
    queryKey: ['inv-locations'],
    queryFn: () => api.get('/stock/locations', { params: { active: 'false' } }).then((r) => asInvList(r.data)),
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-lite'],
    queryFn: () => api.get('/warehouses').then((r) => r.data?.warehouses || r.data || []),
  })

  const { data: settings } = useQuery({
    queryKey: ['stock-settings'],
    queryFn: () => api.get('/stock/settings').then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: accounts } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data || []),
    staleTime: 60_000,
  })

  const accountingEnabled = isFullInventoryAccounting(settings || {})
  const activeAccounts = Array.isArray(accounts) ? accounts.filter((a) => a?.isActive !== false) : []

  const parentCandidates = useMemo(() => {
    const list = Array.isArray(allLocations) ? allLocations : []
    return list.filter((p) => !isEdit || String(p._id) !== String(id))
  }, [allLocations, id, isEdit])

  useEffect(() => {
    if (!existing) return
    const parentId = existing.parentId?._id || existing.parentId || ''
    setForm({
      name: existing.name || '',
      nameAr: existing.nameAr || '',
      parentId: parentId ? String(parentId) : '',
      usage: existing.usage === 'scrap' ? 'inventoryLoss' : (existing.usage || 'internal'),
      warehouseId: existing.warehouseId?._id || existing.warehouseId || '',
      isScrapLocation: !!(existing.isScrapLocation || existing.usage === 'scrap'),
      isReturnLocation: !!existing.isReturnLocation,
      stockValuationAccountId: existing.stockValuationAccountId?._id || existing.stockValuationAccountId || '',
      stockInputAccountId: existing.stockInputAccountId?._id || existing.stockInputAccountId || '',
      stockOutputAccountId: existing.stockOutputAccountId?._id || existing.stockOutputAccountId || '',
      barcode: existing.barcode || '',
      active: existing.active !== false,
    })
    if (parentId) {
      const p = (allLocations || []).find((x) => String(x._id) === String(parentId))
      if (p) {
        setParentOption({
          _id: String(p._id),
          name: p.completePath || p.name,
          completePath: p.completePath,
        })
      }
    } else {
      setParentOption(null)
    }
  }, [existing, allLocations])

  const mut = useMutation({
    mutationFn: (body) =>
      isEdit ? api.patch(`/stock/locations/${id}`, body) : api.post('/stock/locations', body),
    onSuccess: () => {
      toast.success(ar ? 'تم الحفظ' : 'Saved')
      qc.invalidateQueries({ queryKey: ['inv-locations'] })
      qc.invalidateQueries({ queryKey: ['inv-location', id] })
      navigate('/app/dashboard/inventory/locations')
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const fetchParents = async (q) => {
    const needle = String(q || '').trim().toLowerCase()
    const rows = parentCandidates
      .filter((p) => {
        if (!needle) return true
        const hay = [p.name, p.nameAr, p.completePath, p.barcode].filter(Boolean).join(' ').toLowerCase()
        return hay.includes(needle)
      })
      .slice(0, 40)
      .map((p) => ({
        _id: String(p._id),
        name: p.completePath || p.name,
        completePath: p.completePath,
        usage: p.usage,
      }))
    return rows
  }

  const pathPreview = useMemo(() => {
    const name = form.name.trim()
    if (!name) return ''
    if (parentOption?.completePath) return `${parentOption.completePath}/${name}`
    return name
  }, [form.name, parentOption])

  return (
    <div className="mx-auto max-w-3xl space-y-5" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => navigate('/app/dashboard/inventory/locations')}
            aria-label={ar ? 'رجوع' : 'Back'}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {isEdit ? (ar ? 'إعداد الموقع' : 'Location configuration') : (ar ? 'موقع جديد' : 'New location')}
            </h1>
            {pathPreview ? (
              <p className="mt-0.5 font-mono text-xs text-slate-400">{pathPreview}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={mut.isPending || !form.name.trim()}
          onClick={() => mut.mutate({
            ...form,
            parentId: form.parentId || null,
            warehouseId: form.warehouseId || null,
            usage: form.usage || 'internal',
            stockValuationAccountId: form.stockValuationAccountId || null,
            stockInputAccountId: form.stockInputAccountId || null,
            stockOutputAccountId: form.stockOutputAccountId || null,
          })}
        >
          <Save className="h-4 w-4" />
          {ar ? 'حفظ' : 'Save'}
        </button>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {ar ? 'عام' : 'General'}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label text-xs">{ar ? 'اسم الموقع *' : 'Location name *'}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={ar ? 'Input' : 'Input'}
              required
              autoFocus={!isEdit}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label text-xs">{ar ? 'الموقع الأب' : 'Parent location'}</label>
            <AsyncCombobox
              value={form.parentId || null}
              selectedOption={parentOption}
              onChange={(pid, opt) => {
                setForm((f) => ({ ...f, parentId: pid || '' }))
                setParentOption(opt || null)
              }}
              fetchOptions={fetchParents}
              queryKeyPrefix="location-parent"
              getOptionLabel={(o) => o?.completePath || o?.name || '—'}
              getOptionSub={(o) => o?.usage || ''}
              placeholder={ar ? 'بحث مثل WH-001-01…' : 'Search e.g. WH-001-01…'}
              minChars={0}
              noResultsText={ar ? 'لا نتائج' : 'No results'}
            />
            <p className="mt-1 text-xs text-slate-400">
              {ar
                ? 'يُبنى المسار الكامل تلقائياً من الأب + الاسم.'
                : 'Full path is auto-constructed from parent + name.'}
            </p>
          </div>
          <div>
            <label className="label text-xs">{ar ? 'نوع الموقع *' : 'Location type *'}</label>
            <select
              className="select"
              value={form.usage}
              onChange={(e) => setForm((f) => ({ ...f, usage: e.target.value }))}
            >
              {USAGE_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>{ar ? u.ar : u.en}</option>
              ))}
            </select>
            {form.usage === 'view' ? (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                {ar
                  ? 'مواقع العرض مجلدات افتراضية — لا يمكن ترحيل مخزون إليها.'
                  : 'View locations are virtual folders — inventory cannot be posted to them.'}
              </p>
            ) : null}
          </div>
          <div>
            <label className="label text-xs">{ar ? 'المستودع' : 'Warehouse'}</label>
            <select
              className="select"
              value={form.warehouseId}
              onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value }))}
            >
              <option value="">—</option>
              {(warehouses || []).map((w) => (
                <option key={w._id} value={w._id}>{w.code || w.nameEn || w.name}</option>
              ))}
            </select>
          </div>
          {isEdit ? (
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              {ar ? 'نشط' : 'Active'}
            </label>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-dark-600 dark:bg-dark-900/40">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {ar ? 'تفاصيل لوجستية' : 'Logistics details'}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label text-xs">{ar ? 'الباركود' : 'Barcode'}</label>
            <input
              className="input"
              value={form.barcode}
              onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
              placeholder={ar ? 'للملصق المطبوع على الصندوق' : 'Used on the physical bin label'}
            />
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 dark:border-dark-600 dark:bg-dark-800 dark:text-slate-100">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={form.isScrapLocation}
              onChange={(e) => setForm((f) => ({ ...f, isScrapLocation: e.target.checked }))}
            />
            {ar ? 'موقع إتلاف؟' : 'Is a Scrap Location?'}
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 dark:border-dark-600 dark:bg-dark-800 dark:text-slate-100">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={form.isReturnLocation}
              onChange={(e) => setForm((f) => ({ ...f, isReturnLocation: e.target.checked }))}
            />
            {ar ? 'موقع مرتجعات؟' : 'Is a Return Location?'}
          </label>
        </div>
      </section>

      {accountingEnabled ? (
        <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-dark-600 dark:bg-dark-800">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {ar ? 'حسابات المخزون (اختياري)' : 'Stock accounts (optional)'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { key: 'stockValuationAccountId', en: 'Valuation', ar: 'التقييم' },
              { key: 'stockInputAccountId', en: 'Input', ar: 'الإدخال' },
              { key: 'stockOutputAccountId', en: 'Output', ar: 'الإخراج' },
            ].map((f) => (
              <div key={f.key}>
                <label className="label text-xs">{ar ? f.ar : f.en}</label>
                <select
                  className="select"
                  value={form[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                >
                  <option value="">—</option>
                  {activeAccounts.map((a) => (
                    <option key={a._id} value={a._id}>{categoryAccountLabel(a, language)}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
