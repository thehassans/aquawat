import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ArrowLeft, Plus, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import EmptyState from '../../components/ui/EmptyState'
import ImportExportDialog, { InventoryIeButtons } from '../../components/inventory/ImportExportDialog'
import { isFullInventoryAccounting } from '../../lib/inventoryAccountingMode'
import { formatInvError } from '../../lib/invError'
import { invTableWrapClass, invTableClass } from './inventoryUi'

const categoryAccountLabel = (row, language) => {
  if (!row) return '—'
  const name = language === 'ar' ? (row.nameAr || row.name) : row.name
  return row.code ? `${row.code} · ${name}` : name
}

const journalLabel = (row) => {
  if (!row) return '—'
  return row.code ? `${row.code} · ${row.name}` : row.name
}

function ListShell({ title, subtitle, action, children, empty, loading }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {loading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : empty ? (
        empty
      ) : (
        children
      )}
    </div>
  )
}

function FormShell({ title, backTo, children, onSubmit, pending }) {
  const { language } = useSelector((s) => s.ui)
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(backTo)}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
      </div>
      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        {children}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(backTo)}>
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            <Save className="h-4 w-4" />
            {language === 'ar' ? 'حفظ' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function OperationTypesPage() {
  const { language } = useSelector((s) => s.ui)
  const { data, isLoading } = useQuery({
    queryKey: ['inv-operation-types'],
    queryFn: () => api.get('/stock/operation-types', { params: { active: 'false' } }).then((r) => asInvList(r.data)),
  })
  const rows = data || []

  return (
    <ListShell
      title={language === 'ar' ? 'أنواع العمليات' : 'Operation Types'}
      subtitle={language === 'ar' ? 'إيصالات، تسليم، تحويلات…' : 'Receipts, deliveries, internals…'}
      action={
        <Link to="/app/dashboard/inventory/operation-types/new" className="btn btn-primary btn-sm">
          <Plus className="h-4 w-4" />
          {language === 'ar' ? 'نوع' : 'Type'}
        </Link>
      }
      loading={isLoading}
      empty={!rows.length ? <EmptyState title={language === 'ar' ? 'لا أنواع' : 'No operation types'} /> : null}
    >
      <div className={invTableWrapClass}>
        <table className={`${invTableClass} min-w-[720px]`}>
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
            <tr>
              <th className="min-w-[150px] px-3 py-2">{language === 'ar' ? 'الاسم' : 'Name'}</th>
              <th className="min-w-[150px] px-3 py-2">{language === 'ar' ? 'الرمز' : 'Code'}</th>
              <th className="min-w-[150px] px-3 py-2">{language === 'ar' ? 'التسلسل' : 'Sequence'}</th>
              <th className="min-w-[150px] px-3 py-2">{language === 'ar' ? 'نشط' : 'Active'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
            {rows.map((ot) => (
              <tr key={ot._id}>
                <td className="px-3 py-2.5">
                  <Link
                    to={`/app/dashboard/inventory/operation-types/${ot._id}/edit`}
                    className="font-medium text-primary-700 dark:text-primary-300"
                  >
                    {language === 'ar' && ot.nameAr ? ot.nameAr : ot.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5">{ot.code}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{ot.sequenceCode}</td>
                <td className="px-3 py-2.5">{ot.active === false ? '—' : '✓'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ListShell>
  )
}

export function OperationTypeForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { language } = useSelector((s) => s.ui)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    nameAr: '',
    code: 'internal',
    warehouseId: '',
    sequencePrefix: '',
    sequenceCode: '',
    defaultSourceLocationId: '',
    defaultDestLocationId: '',
    reservationMethod: 'atConfirm',
    createBackorder: 'ask',
    active: true,
  })

  const { data: existing } = useQuery({
    queryKey: ['inv-operation-type', id],
    queryFn: () => api.get(`/stock/operation-types/${id}`).then((r) => r.data),
    enabled: isEdit,
  })
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-lite'],
    queryFn: () => api.get('/warehouses').then((r) => r.data?.warehouses || r.data || []),
  })
  const { data: locations } = useQuery({
    queryKey: ['inv-locations'],
    queryFn: () => api.get('/stock/locations').then((r) => asInvList(r.data)),
  })

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name || '',
        nameAr: existing.nameAr || '',
        code: existing.code || 'internal',
        warehouseId: existing.warehouseId || '',
        sequencePrefix: existing.sequencePrefix || '',
        sequenceCode: existing.sequenceCode || '',
        defaultSourceLocationId: existing.defaultSourceLocationId || '',
        defaultDestLocationId: existing.defaultDestLocationId || '',
        reservationMethod: existing.reservationMethod || 'atConfirm',
        createBackorder: existing.createBackorder || 'ask',
        active: existing.active !== false,
      })
    }
  }, [existing])

  const mut = useMutation({
    mutationFn: (body) =>
      isEdit ? api.patch(`/stock/operation-types/${id}`, body) : api.post('/stock/operation-types', body),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم الحفظ' : 'Saved')
      qc.invalidateQueries({ queryKey: ['inv-operation-types'] })
      navigate('/app/dashboard/inventory/operation-types')
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const locs = Array.isArray(locations) ? locations : []

  return (
    <FormShell
      title={isEdit
        ? (language === 'ar' ? 'تعديل نوع عملية' : 'Edit operation type')
        : (language === 'ar' ? 'نوع عملية جديد' : 'New operation type')}
      backTo="/app/dashboard/inventory/operation-types"
      pending={mut.isPending}
      onSubmit={(e) => {
        e.preventDefault()
        mut.mutate({
          ...form,
          defaultSourceLocationId: form.defaultSourceLocationId || null,
          defaultDestLocationId: form.defaultDestLocationId || null,
        })
      }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">{language === 'ar' ? 'الاسم' : 'Name'} *</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">{language === 'ar' ? 'الاسم (عربي)' : 'Name (AR)'}</label>
          <input className="input" dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
        </div>
        <div>
          <label className="label">{language === 'ar' ? 'النوع' : 'Type'} *</label>
          <select className="select" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}>
            {['incoming', 'outgoing', 'internal', 'pos', 'manufacturing'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{language === 'ar' ? 'المستودع' : 'Warehouse'} *</label>
          <select
            className="select"
            required
            disabled={isEdit}
            value={form.warehouseId}
            onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
          >
            <option value="">—</option>
            {(warehouses || []).map((w) => (
              <option key={w._id} value={w._id}>{w.code || w.nameEn || w.name}</option>
            ))}
          </select>
        </div>
        {!isEdit && (
          <>
            <div>
              <label className="label">{language === 'ar' ? 'بادئة التسلسل' : 'Sequence prefix'} *</label>
              <input className="input" required value={form.sequencePrefix} onChange={(e) => setForm({ ...form, sequencePrefix: e.target.value })} />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'رمز التسلسل' : 'Sequence code'} *</label>
              <input className="input" required value={form.sequenceCode} onChange={(e) => setForm({ ...form, sequenceCode: e.target.value })} />
            </div>
          </>
        )}
        {isEdit && (
          <div className="md:col-span-2 text-xs text-slate-500">
            {language === 'ar' ? 'التسلسل:' : 'Sequence:'}{' '}
            <span className="font-mono">{form.sequenceCode}</span>
          </div>
        )}
        <div>
          <label className="label">{language === 'ar' ? 'المصدر الافتراضي' : 'Default source'}</label>
          <select className="select" value={form.defaultSourceLocationId} onChange={(e) => setForm({ ...form, defaultSourceLocationId: e.target.value })}>
            <option value="">—</option>
            {locs.map((l) => <option key={l._id} value={l._id}>{l.completePath}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{language === 'ar' ? 'الوجهة الافتراضية' : 'Default destination'}</label>
          <select className="select" value={form.defaultDestLocationId} onChange={(e) => setForm({ ...form, defaultDestLocationId: e.target.value })}>
            <option value="">—</option>
            {locs.map((l) => <option key={l._id} value={l._id}>{l.completePath}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{language === 'ar' ? 'الحجز' : 'Reservation'}</label>
          <select className="select" value={form.reservationMethod} onChange={(e) => setForm({ ...form, reservationMethod: e.target.value })}>
            <option value="atConfirm">atConfirm</option>
            <option value="manual">manual</option>
            <option value="byDate">byDate</option>
          </select>
        </div>
        <div>
          <label className="label">{language === 'ar' ? 'الطلب المتأخر' : 'Backorder'}</label>
          <select className="select" value={form.createBackorder} onChange={(e) => setForm({ ...form, createBackorder: e.target.value })}>
            <option value="ask">ask</option>
            <option value="always">always</option>
            <option value="never">never</option>
          </select>
        </div>
        {isEdit && (
          <div className="flex items-center gap-2 md:col-span-2">
            <input type="checkbox" id="ot-active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            <label htmlFor="ot-active" className="text-sm">{language === 'ar' ? 'نشط' : 'Active'}</label>
          </div>
        )}
      </div>
    </FormShell>
  )
}

export function ProductCategoriesPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [selected, setSelected] = useState(() => new Set())
  const [page, setPage] = useState(1)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteBlock, setDeleteBlock] = useState(null)
  const [ieOpen, setIeOpen] = useState(null)
  const pageSize = 50

  const { data, isLoading } = useQuery({
    queryKey: ['inv-product-categories'],
    queryFn: () => api.get('/stock/product-categories').then((r) => asInvList(r.data)),
  })
  const allRows = useMemo(() => {
    const rows = data || []
    return [...rows].sort((a, b) => String(a.completePath || '').localeCompare(String(b.completePath || '')))
  }, [data])
  const total = allRows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rows = allRows.slice((page - 1) * pageSize, page * pageSize)
  const from = total ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(page * pageSize, total)
  const pageAllSelected = rows.length > 0 && rows.every((r) => selected.has(r._id))

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (pageAllSelected) {
        rows.forEach((r) => next.delete(r._id))
      } else {
        rows.forEach((r) => next.add(r._id))
      }
      return next
    })
  }

  const dupMut = useMutation({
    mutationFn: (id) => api.post(`/stock/product-categories/${id}/duplicate`),
    onSuccess: (res) => {
      toast.success(ar ? 'تم النسخ' : 'Duplicated')
      qc.invalidateQueries({ queryKey: ['inv-product-categories'] })
      navigate(`/app/dashboard/inventory/product-categories/${res.data._id}/edit`)
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const delMut = useMutation({
    mutationFn: (id) => api.delete(`/stock/product-categories/${id}`),
    onSuccess: () => {
      toast.success(ar ? 'تم الحذف' : 'Deleted')
      setSelected(new Set())
      setDeleteBlock(null)
      qc.invalidateQueries({ queryKey: ['inv-product-categories'] })
    },
    onError: (e) => {
      const data = e.response?.data
      if (data?.code === 'CAT_IN_USE') {
        setDeleteBlock({
          message: data.error,
          meta: data.meta || {},
        })
      } else {
        toast.error(formatInvError(e, language))
      }
    },
  })

  const selectedIds = [...selected]
  const primaryId = selectedIds[0]

  return (
    <ListShell
      title={ar ? 'فئات المنتجات' : 'Product Categories'}
      subtitle={ar ? 'مسار كامل · تقييم · مسارات' : 'Full path · valuation · routes'}
      action={
        <div className="flex flex-wrap gap-2">
          <InventoryIeButtons
            model="product_categories"
            ar={ar}
            onImported={() => qc.invalidateQueries({ queryKey: ['inv-product-categories'] })}
          />
          <div className="relative">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!selectedIds.length}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {ar ? 'إجراءات' : 'Actions'}{selectedIds.length ? ` (${selectedIds.length})` : ''}
            </button>
            {menuOpen && selectedIds.length > 0 && (
              <div className="absolute end-0 z-30 mt-1 min-w-[12rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-dark-600 dark:bg-dark-800">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-dark-700"
                  onClick={() => {
                    setMenuOpen(false)
                    setIeOpen('export')
                  }}
                >
                  {ar ? 'تصدير' : 'Export'}
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-dark-700"
                  disabled={!primaryId || dupMut.isPending}
                  onClick={() => {
                    setMenuOpen(false)
                    dupMut.mutate(primaryId)
                  }}
                >
                  {ar ? 'تكرار' : 'Duplicate'}
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-start text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  disabled={!primaryId || delMut.isPending}
                  onClick={() => {
                    setMenuOpen(false)
                    if (window.confirm(ar ? 'حذف الفئة المحددة؟' : 'Delete selected category?')) {
                      delMut.mutate(primaryId)
                    }
                  }}
                >
                  {ar ? 'حذف' : 'Delete'}
                </button>
              </div>
            )}
          </div>
          <Link to="/app/dashboard/inventory/product-categories/new" className="btn btn-primary btn-sm">
            <Plus className="h-4 w-4" />
            {ar ? 'جديد' : 'New'}
          </Link>
        </div>
      }
      loading={isLoading}
      empty={!allRows.length ? <EmptyState title={ar ? 'لا فئات' : 'No categories'} /> : null}
    >
      {deleteBlock && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p>{deleteBlock.message}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(deleteBlock.meta?.productCount || 0) > 0 && deleteBlock.meta?.categoryId && (
              <Link
                className="btn btn-secondary btn-sm"
                to={`/app/dashboard/inventory/products?categoryId=${deleteBlock.meta.categoryId}`}
              >
                {ar ? `عرض المنتجات (${deleteBlock.meta.productCount})` : `Show products (${deleteBlock.meta.productCount})`}
              </Link>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeleteBlock(null)}>
              {ar ? 'إغلاق' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>{from}-{to} / {total}</span>
        <div className="flex gap-1">
          <button type="button" className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
          <button type="button" className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
        </div>
      </div>

      <div className={invTableWrapClass}>
        <table className={`${invTableClass} min-w-[720px]`}>
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={pageAllSelected}
                  onChange={toggleAll}
                />
              </th>
              <th className="min-w-[150px] px-3 py-2">{ar ? 'فئة المنتج' : 'Product Category'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
            {rows.map((c) => (
              <tr key={c._id} className={selected.has(c._id) ? 'bg-primary-50/40 dark:bg-primary-950/20' : ''}>
                <td className="px-3 py-2.5">
                  <input type="checkbox" checked={selected.has(c._id)} onChange={() => toggle(c._id)} />
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    to={`/app/dashboard/inventory/product-categories/${c._id}/edit`}
                    className="font-medium text-primary-700 dark:text-primary-300"
                  >
                    {c.completePath}
                  </Link>
                  <div className="text-[11px] text-slate-400">
                    {c.costingMethod} · {c.valuationMode}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ieOpen && (
        <ImportExportDialog
          mode={ieOpen}
          model="product_categories"
          ar={ar}
          filters={selectedIds.length ? { ids: selectedIds } : {}}
          onClose={() => setIeOpen(null)}
          onImported={() => qc.invalidateQueries({ queryKey: ['inv-product-categories'] })}
        />
      )}
    </ListShell>
  )
}

export function ProductCategoryForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { language } = useSelector((s) => s.ui)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    nameAr: '',
    parentId: '',
    costingMethod: 'average',
    valuationMode: 'automated',
    allowNegativeStock: false,
    forceRemovalStrategy: '',
    stockValuationAccountId: '',
    stockJournalId: '',
    stockInputAccountId: '',
    stockOutputAccountId: '',
    incomeAccountId: '',
    expenseAccountId: '',
    priceDifferenceAccountId: '',
  })
  const [costingPreview, setCostingPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const { data: existing } = useQuery({
    queryKey: ['inv-product-category', id],
    queryFn: () => api.get(`/stock/product-categories/${id}`).then((r) => r.data),
    enabled: isEdit,
  })
  const { data: cats } = useQuery({
    queryKey: ['inv-product-categories'],
    queryFn: () => api.get('/stock/product-categories').then((r) => asInvList(r.data)),
  })
  const { data: accounts } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data || []),
    staleTime: 60_000,
  })
  const { data: journals } = useQuery({
    queryKey: ['stock-journal-books', 'stock'],
    queryFn: () => api.get('/stock/journal-books', { params: { type: 'stock' } }).then((r) => r.data || []),
    staleTime: 60_000,
  })
  const { data: invSettings } = useQuery({
    queryKey: ['stock-settings'],
    queryFn: () => api.get('/stock/settings').then((r) => r.data),
    staleTime: 60_000,
  })
  const fullAccounting = isFullInventoryAccounting(invSettings || {})
  const activeAccounts = Array.isArray(accounts) ? accounts.filter((a) => a?.isActive !== false) : []
  const journalOptions = Array.isArray(journals) ? journals.filter((j) => j?.active !== false) : []

  useEffect(() => {
    if (isEdit || !invSettings) return
    if (!fullAccounting) {
      setForm((f) => (f.valuationMode === 'manual' ? f : { ...f, valuationMode: 'manual' }))
    }
  }, [isEdit, invSettings, fullAccounting])

  useEffect(() => {
    if (!existing) return
    setForm({
      name: existing.name || '',
      nameAr: existing.nameAr || '',
      parentId: existing.parentId?._id || existing.parentId || '',
      costingMethod: existing.costingMethod || 'average',
      valuationMode: existing.valuationMode || 'automated',
      allowNegativeStock: !!existing.allowNegativeStock,
      forceRemovalStrategy: existing.forceRemovalStrategy || '',
      stockValuationAccountId: existing.stockValuationAccountId?._id || existing.stockValuationAccountId || '',
      stockJournalId: existing.stockJournalId?._id || existing.stockJournalId || '',
      stockInputAccountId: existing.stockInputAccountId?._id || existing.stockInputAccountId || '',
      stockOutputAccountId: existing.stockOutputAccountId?._id || existing.stockOutputAccountId || '',
      incomeAccountId: existing.incomeAccountId?._id || existing.incomeAccountId || '',
      expenseAccountId: existing.expenseAccountId?._id || existing.expenseAccountId || '',
      priceDifferenceAccountId: existing.priceDifferenceAccountId?._id || existing.priceDifferenceAccountId || '',
    })
  }, [existing])

  // Prefer default Stock journal when creating automated categories
  useEffect(() => {
    if (isEdit || form.stockJournalId) return
    const list = Array.isArray(journals) ? journals.filter((j) => j?.active !== false) : []
    if (!list.length) return
    const stj = list.find((j) => j.code === 'STJ') || list[0]
    if (stj?._id) setForm((f) => (f.stockJournalId ? f : { ...f, stockJournalId: stj._id }))
  }, [isEdit, form.stockJournalId, journals])

  useEffect(() => {
    if (!isEdit || !form.costingMethod || form.costingMethod === existing?.costingMethod) {
      setCostingPreview(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    api.get(`/stock/product-categories/${id}/costing-preview`, {
      params: { costingMethod: form.costingMethod },
    }).then((r) => {
      if (!cancelled) setCostingPreview(r.data)
    }).catch(() => {
      if (!cancelled) setCostingPreview(null)
    }).finally(() => {
      if (!cancelled) setPreviewLoading(false)
    })
    return () => { cancelled = true }
  }, [isEdit, id, form.costingMethod, existing?.costingMethod])

  const mut = useMutation({
    mutationFn: (body) =>
      isEdit ? api.patch(`/stock/product-categories/${id}`, body) : api.post('/stock/product-categories', body),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم الحفظ' : 'Saved')
      qc.invalidateQueries({ queryKey: ['inv-product-categories'] })
      navigate('/app/dashboard/inventory/product-categories')
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const parents = (Array.isArray(cats) ? cats : []).filter((c) => !isEdit || String(c._id) !== String(id))

  return (
    <FormShell
      title={isEdit
        ? (language === 'ar' ? 'تعديل فئة' : 'Edit category')
        : (language === 'ar' ? 'فئة جديدة' : 'New category')}
      backTo="/app/dashboard/inventory/product-categories"
      pending={mut.isPending}
      onSubmit={(e) => {
        e.preventDefault()
        if (form.valuationMode === 'automated' && fullAccounting) {
          const required = [
            ['stockValuationAccountId', language === 'ar' ? 'حساب تقييم المخزون' : 'Stock Valuation Account'],
            ['stockJournalId', language === 'ar' ? 'دفتر المخزون' : 'Stock Journal'],
            ['stockInputAccountId', language === 'ar' ? 'حساب الإدخال' : 'Stock Input Account'],
            ['stockOutputAccountId', language === 'ar' ? 'حساب الإخراج' : 'Stock Output Account'],
            ['expenseAccountId', language === 'ar' ? 'حساب المصروف' : 'Expense Account'],
          ]
          const missing = required.filter(([k]) => !form[k]).map(([, label]) => label)
          if (missing.length) {
            toast.error(
              language === 'ar'
                ? `محاسبة المخزون الكاملة تتطلب: ${missing.join('، ')}`
                : `Full inventory accounting requires: ${missing.join(', ')}`,
            )
            return
          }
        }
        if (!form.incomeAccountId) {
          toast(
            language === 'ar'
              ? 'مستحسن: عيّن حساب إيراد على الفئة للمنتجات المباعة'
              : 'Recommended: set an income account on the category for sold products',
            { icon: '💡' },
          )
        }
        if (!form.expenseAccountId && !(form.valuationMode === 'automated' && fullAccounting)) {
          toast(
            language === 'ar'
              ? 'مستحسن: عيّن حساب مصروف على الفئة للمشتريات'
              : 'Recommended: set an expense account on the category for purchases',
            { icon: '💡' },
          )
        }
        if (costingPreview && Number(costingPreview.delta) !== 0) {
          const ok = window.confirm(
            language === 'ar'
              ? `فرق التقييم المتوقع: ${costingPreview.delta}. المتابعة؟`
              : `Expected valuation delta: ${costingPreview.delta}. Continue?`,
          )
          if (!ok) return
        }
        mut.mutate({
          ...form,
          parentId: form.parentId || null,
          forceRemovalStrategy: form.forceRemovalStrategy || undefined,
          stockValuationAccountId: form.stockValuationAccountId || null,
          stockJournalId: form.stockJournalId || null,
          stockInputAccountId: form.stockInputAccountId || null,
          stockOutputAccountId: form.stockOutputAccountId || null,
          incomeAccountId: form.incomeAccountId || null,
          expenseAccountId: form.expenseAccountId || null,
          priceDifferenceAccountId: form.priceDifferenceAccountId || null,
        })
      }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">{language === 'ar' ? 'الاسم' : 'Name'} *</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">{language === 'ar' ? 'الاسم (عربي)' : 'Name (AR)'}</label>
          <input className="input" dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
        </div>
        <div>
          <label className="label">{language === 'ar' ? 'الأب' : 'Parent'}</label>
          <select className="select" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
            <option value="">{language === 'ar' ? '— جذر —' : '— Root —'}</option>
            {parents.map((p) => <option key={p._id} value={p._id}>{p.completePath}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{language === 'ar' ? 'طريقة التكلفة' : 'Costing method'}</label>
          <select className="select" value={form.costingMethod} onChange={(e) => setForm({ ...form, costingMethod: e.target.value })}>
            <option value="average">average</option>
            <option value="fifo">fifo</option>
            <option value="standard">standard</option>
          </select>
        </div>
        <div>
          <label className="label">{language === 'ar' ? 'التقييم' : 'Valuation'}</label>
          <select className="select" value={form.valuationMode} onChange={(e) => setForm({ ...form, valuationMode: e.target.value })}>
            <option value="automated">automated</option>
            <option value="manual">manual</option>
          </select>
        </div>
        <div>
          <label className="label">{language === 'ar' ? 'استراتيجية الإخراج' : 'Removal strategy'}</label>
          <select className="select" value={form.forceRemovalStrategy} onChange={(e) => setForm({ ...form, forceRemovalStrategy: e.target.value })}>
            <option value="">—</option>
            {['fifo', 'lifo', 'fefo', 'closest'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 md:col-span-2">
          <input
            id="allowNeg"
            type="checkbox"
            className="checkbox"
            checked={form.allowNegativeStock}
            onChange={(e) => setForm({ ...form, allowNegativeStock: e.target.checked })}
          />
          <label htmlFor="allowNeg" className="text-sm text-slate-700 dark:text-slate-200">
            {language === 'ar'
              ? 'السماح بالمخزون السالب عند الاعتماد'
              : 'Allow negative stock on validate'}
          </label>
        </div>
      </div>

      {form.valuationMode === 'automated' && fullAccounting && (
        <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 md:grid-cols-2 dark:border-dark-600">
          <div className="md:col-span-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {language === 'ar' ? 'خصائص حسابات المخزون' : 'Account Stock Properties'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {language === 'ar'
                ? 'مطلوبة لأن وضع المستأجر = محاسبة مخزون كاملة (أنجلو ساكسون).'
                : 'Required because tenant mode is Full inventory accounting (Anglo-Saxon).'}
            </p>
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'حساب تقييم المخزون' : 'Stock Valuation Account'} *</label>
            <select className="select" required value={form.stockValuationAccountId} onChange={(e) => setForm({ ...form, stockValuationAccountId: e.target.value })}>
              <option value="">—</option>
              {activeAccounts.map((a) => <option key={a._id} value={a._id}>{categoryAccountLabel(a, language)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'دفتر المخزون' : 'Stock Journal'} *</label>
            <select className="select" required value={form.stockJournalId} onChange={(e) => setForm({ ...form, stockJournalId: e.target.value })}>
              <option value="">—</option>
              {journalOptions.map((j) => <option key={j._id} value={j._id}>{journalLabel(j)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'حساب الإدخال' : 'Stock Input Account'} *</label>
            <select className="select" required value={form.stockInputAccountId} onChange={(e) => setForm({ ...form, stockInputAccountId: e.target.value })}>
              <option value="">—</option>
              {activeAccounts.map((a) => <option key={a._id} value={a._id}>{categoryAccountLabel(a, language)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'حساب الإخراج' : 'Stock Output Account'} *</label>
            <select className="select" required value={form.stockOutputAccountId} onChange={(e) => setForm({ ...form, stockOutputAccountId: e.target.value })}>
              <option value="">—</option>
              {activeAccounts.map((a) => <option key={a._id} value={a._id}>{categoryAccountLabel(a, language)}</option>)}
            </select>
          </div>
        </div>
      )}

      {form.valuationMode === 'automated' && !fullAccounting && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-dark-600 dark:bg-dark-800 dark:text-slate-300">
          {language === 'ar'
            ? 'خصائص حسابات المخزون مخفية — فعّل «محاسبة مخزون كاملة» من إعدادات المخزون لترحيل قيود التقييم.'
            : 'Stock account properties are hidden — enable Full inventory accounting in Inventory Settings to post valuation journals.'}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 md:grid-cols-2 dark:border-dark-600">
        <div className="md:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {language === 'ar' ? 'خصائص الحسابات' : 'Account Properties'}
          </h3>
        </div>
        <div>
          <label className="label">
            {language === 'ar' ? 'حساب الإيراد' : 'Income Account'}
            <span className="ms-1 font-normal text-slate-400">
              {language === 'ar' ? '(مستحسن للمنتجات المباعة)' : '(recommended for sold products)'}
            </span>
          </label>
          <select className="select" value={form.incomeAccountId} onChange={(e) => setForm({ ...form, incomeAccountId: e.target.value })}>
            <option value="">—</option>
            {activeAccounts.map((a) => <option key={a._id} value={a._id}>{categoryAccountLabel(a, language)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">
            {language === 'ar' ? 'حساب المصروف' : 'Expense Account'}
            {form.valuationMode === 'automated' && fullAccounting ? ' *' : ''}
          </label>
          <select className="select" required={form.valuationMode === 'automated' && fullAccounting} value={form.expenseAccountId} onChange={(e) => setForm({ ...form, expenseAccountId: e.target.value })}>
            <option value="">—</option>
            {activeAccounts.map((a) => <option key={a._id} value={a._id}>{categoryAccountLabel(a, language)}</option>)}
          </select>
        </div>
        {fullAccounting && (
          <div>
            <label className="label">{language === 'ar' ? 'حساب فرق السعر' : 'Price Difference Account'}</label>
            <select className="select" value={form.priceDifferenceAccountId} onChange={(e) => setForm({ ...form, priceDifferenceAccountId: e.target.value })}>
              <option value="">—</option>
              {activeAccounts.map((a) => <option key={a._id} value={a._id}>{categoryAccountLabel(a, language)}</option>)}
            </select>
          </div>
        )}
      </div>

      {isEdit && form.costingMethod !== existing?.costingMethod && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
          {previewLoading ? (
            <span className="text-slate-500">…</span>
          ) : costingPreview ? (
            <div className="space-y-1">
              <div className="font-medium text-amber-900 dark:text-amber-200">
                {language === 'ar' ? 'معاينة فرق التقييم' : 'Valuation delta preview'}
              </div>
              <div className="tabular-nums text-slate-700 dark:text-slate-200">
                {costingPreview.currentTotal} → {costingPreview.proposedTotal}
                {' '}({language === 'ar' ? 'الفرق' : 'delta'}: {costingPreview.delta})
              </div>
              <div className="text-xs text-slate-500">
                {costingPreview.productCount} {language === 'ar' ? 'منتج' : 'products'}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </FormShell>
  )
}

export function StorageCategoriesPage() {
  const { language } = useSelector((s) => s.ui)
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['inv-storage-categories'],
    queryFn: () => api.get('/stock/storage-categories').then((r) => asInvList(r.data)),
  })
  const items = data || []

  const mut = useMutation({
    mutationFn: () => api.post('/stock/storage-categories', { name }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تمت الإضافة' : 'Added')
      setName('')
      qc.invalidateQueries({ queryKey: ['inv-storage-categories'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  return (
    <ListShell
      title={language === 'ar' ? 'فئات التخزين' : 'Storage Categories'}
      subtitle={language === 'ar' ? 'سعة المواقع' : 'Location capacity constraints'}
      loading={isLoading}
      empty={!items.length && !isLoading ? <EmptyState title={language === 'ar' ? 'لا فئات' : 'No storage categories'} /> : null}
    >
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) mut.mutate()
        }}
      >
        <input className="input max-w-xs" placeholder={language === 'ar' ? 'اسم الفئة' : 'Category name'} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={mut.isPending}>
          <Plus className="h-4 w-4" />
          {language === 'ar' ? 'إضافة' : 'Add'}
        </button>
      </form>
      {items.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 dark:divide-dark-700 dark:border-dark-600">
          {items.map((c) => (
            <li key={c._id} className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-100">
              {language === 'ar' && c.nameAr ? c.nameAr : c.name}
            </li>
          ))}
        </ul>
      )}
    </ListShell>
  )
}

