import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ArrowLeft, Plus, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import EmptyState from '../../components/ui/EmptyState'
import ImportExportDialog, { InventoryIeButtons } from '../../components/inventory/ImportExportDialog'

const USAGES = [
  'view', 'internal', 'vendor', 'customer',
  'inventoryLoss', 'scrap', 'production', 'transit',
]

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

export function LocationsPage() {
  const { language } = useSelector((s) => s.ui)
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['inv-locations'],
    queryFn: () => api.get('/stock/locations', { params: { active: 'false' } }).then((r) => r.data),
  })
  const rows = Array.isArray(data) ? data : []

  return (
    <ListShell
      title={language === 'ar' ? 'المواقع' : 'Locations'}
      subtitle={language === 'ar' ? 'شجرة مواقع التخزين' : 'Storage location tree'}
      action={
        <div className="flex flex-wrap gap-2">
          <InventoryIeButtons
            model="locations"
            ar={language === 'ar'}
            onImported={() => qc.invalidateQueries({ queryKey: ['inv-locations'] })}
          />
          <Link to="/app/dashboard/inventory/locations/new" className="btn btn-primary btn-sm">
            <Plus className="h-4 w-4" />
            {language === 'ar' ? 'موقع' : 'Location'}
          </Link>
        </div>
      }
      loading={isLoading}
      empty={
        !rows.length ? (
          <EmptyState
            title={language === 'ar' ? 'لا مواقع' : 'No locations'}
            description={language === 'ar' ? 'فعّل المحرك أو أضف موقعاً' : 'Enable the engine or add a location'}
          />
        ) : null
      }
    >
      <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
            <tr>
              <th className="px-3 py-2">{language === 'ar' ? 'المسار' : 'Path'}</th>
              <th className="px-3 py-2">{language === 'ar' ? 'الاستخدام' : 'Usage'}</th>
              <th className="px-3 py-2">{language === 'ar' ? 'نشط' : 'Active'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
            {rows.map((loc) => (
              <tr key={loc._id} className="hover:bg-slate-50/80 dark:hover:bg-dark-800/50">
                <td className="px-3 py-2.5">
                  <Link
                    to={`/app/dashboard/inventory/locations/${loc._id}/edit`}
                    className="font-medium text-primary-700 dark:text-primary-300"
                  >
                    {loc.completePath}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{loc.usage}</td>
                <td className="px-3 py-2.5">{loc.active === false ? '—' : '✓'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ListShell>
  )
}

export function LocationForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { language } = useSelector((s) => s.ui)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    nameAr: '',
    parentId: '',
    usage: 'internal',
    warehouseId: '',
    barcode: '',
    active: true,
  })

  const { data: existing } = useQuery({
    queryKey: ['inv-location', id],
    queryFn: () => api.get(`/stock/locations/${id}`).then((r) => r.data),
    enabled: isEdit,
  })
  const { data: parents } = useQuery({
    queryKey: ['inv-locations'],
    queryFn: () => api.get('/stock/locations', { params: { active: 'false' } }).then((r) => r.data),
  })
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-lite'],
    queryFn: () => api.get('/warehouses').then((r) => r.data?.warehouses || r.data || []),
  })

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name || '',
        nameAr: existing.nameAr || '',
        parentId: existing.parentId || '',
        usage: existing.usage || 'internal',
        warehouseId: existing.warehouseId || '',
        barcode: existing.barcode || '',
        active: existing.active !== false,
      })
    }
  }, [existing])

  const mut = useMutation({
    mutationFn: (body) =>
      isEdit ? api.patch(`/stock/locations/${id}`, body) : api.post('/stock/locations', body),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم الحفظ' : 'Saved')
      qc.invalidateQueries({ queryKey: ['inv-locations'] })
      navigate('/app/dashboard/inventory/locations')
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const parentOpts = useMemo(
    () => (Array.isArray(parents) ? parents : []).filter((p) => !isEdit || String(p._id) !== String(id)),
    [parents, id, isEdit],
  )

  return (
    <FormShell
      title={isEdit
        ? (language === 'ar' ? 'تعديل موقع' : 'Edit location')
        : (language === 'ar' ? 'موقع جديد' : 'New location')}
      backTo="/app/dashboard/inventory/locations"
      pending={mut.isPending}
      onSubmit={(e) => {
        e.preventDefault()
        mut.mutate({
          ...form,
          parentId: form.parentId || null,
          warehouseId: form.warehouseId || null,
        })
      }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">{language === 'ar' ? 'الاسم' : 'Name'} *</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="label">{language === 'ar' ? 'الاسم (عربي)' : 'Name (AR)'}</label>
          <input className="input" dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
        </div>
        <div>
          <label className="label">{language === 'ar' ? 'الأب' : 'Parent'}</label>
          <select className="select" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
            <option value="">{language === 'ar' ? '— جذر —' : '— Root —'}</option>
            {parentOpts.map((p) => (
              <option key={p._id} value={p._id}>{p.completePath}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{language === 'ar' ? 'الاستخدام' : 'Usage'} *</label>
          <select className="select" value={form.usage} onChange={(e) => setForm({ ...form, usage: e.target.value })}>
            {USAGES.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{language === 'ar' ? 'المستودع' : 'Warehouse'}</label>
          <select className="select" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
            <option value="">—</option>
            {(warehouses || []).map((w) => (
              <option key={w._id} value={w._id}>{w.code || w.nameEn || w.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{language === 'ar' ? 'الباركود' : 'Barcode'}</label>
          <input className="input" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
        </div>
        {isEdit && (
          <div className="flex items-center gap-2 md:col-span-2">
            <input
              type="checkbox"
              id="loc-active"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            <label htmlFor="loc-active" className="text-sm">{language === 'ar' ? 'نشط' : 'Active'}</label>
          </div>
        )}
      </div>
    </FormShell>
  )
}

export function OperationTypesPage() {
  const { language } = useSelector((s) => s.ui)
  const { data, isLoading } = useQuery({
    queryKey: ['inv-operation-types'],
    queryFn: () => api.get('/stock/operation-types', { params: { active: 'false' } }).then((r) => r.data),
  })
  const rows = Array.isArray(data) ? data : []

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
      <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
            <tr>
              <th className="px-3 py-2">{language === 'ar' ? 'الاسم' : 'Name'}</th>
              <th className="px-3 py-2">{language === 'ar' ? 'الرمز' : 'Code'}</th>
              <th className="px-3 py-2">{language === 'ar' ? 'التسلسل' : 'Sequence'}</th>
              <th className="px-3 py-2">{language === 'ar' ? 'نشط' : 'Active'}</th>
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
    queryFn: () => api.get('/stock/locations').then((r) => r.data),
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
    onError: (e) => toast.error(e.response?.data?.error || e.message),
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
    queryFn: () => api.get('/stock/product-categories').then((r) => r.data),
  })
  const allRows = useMemo(() => {
    const rows = Array.isArray(data) ? data : []
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
    onError: (e) => toast.error(e.response?.data?.error || e.message),
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
        toast.error(data?.error || e.message)
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

      <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={pageAllSelected}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-3 py-2">{ar ? 'فئة المنتج' : 'Product Category'}</th>
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
    queryFn: () => api.get('/stock/product-categories').then((r) => r.data),
  })

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
    })
  }, [existing])

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
    onError: (e) => toast.error(e.response?.data?.error || e.message),
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
    queryFn: () => api.get('/stock/storage-categories').then((r) => r.data),
  })
  const items = data?.items || []

  const mut = useMutation({
    mutationFn: () => api.post('/stock/storage-categories', { name }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تمت الإضافة' : 'Added')
      setName('')
      qc.invalidateQueries({ queryKey: ['inv-storage-categories'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
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

export function ReorderingRulesPage() {
  const { language } = useSelector((s) => s.ui)
  const qc = useQueryClient()
  const [form, setForm] = useState({
    productId: '',
    warehouseId: '',
    locationId: '',
    minQty: '0',
    maxQty: '0',
    qtyMultiple: '1',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['inv-reorder-rules'],
    queryFn: () => api.get('/stock/reorder-rules').then((r) => r.data),
  })
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-lite'],
    queryFn: () => api.get('/warehouses').then((r) => r.data?.warehouses || r.data || []),
  })
  const { data: locations } = useQuery({
    queryKey: ['inv-locations-internal'],
    queryFn: () => api.get('/stock/locations', { params: { usage: 'internal' } }).then((r) => r.data),
  })
  const items = data?.items || []
  const locs = Array.isArray(locations) ? locations : []

  const mut = useMutation({
    mutationFn: () => api.post('/stock/reorder-rules', form),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم الحفظ' : 'Saved')
      qc.invalidateQueries({ queryKey: ['inv-reorder-rules'] })
      setForm((f) => ({ ...f, productId: '', minQty: '0', maxQty: '0' }))
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  return (
    <ListShell
      title={language === 'ar' ? 'قواعد إعادة الطلب' : 'Reordering Rules'}
      subtitle={language === 'ar' ? 'الحد الأدنى / الأقصى' : 'Min / max stock levels'}
      loading={isLoading}
      empty={!items.length && !isLoading ? <EmptyState title={language === 'ar' ? 'لا قواعد' : 'No reorder rules'} /> : null}
    >
      <div className="card space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="label">{language === 'ar' ? 'معرّف المنتج' : 'Product ID'}</label>
            <input className="input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} placeholder="ObjectId" />
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'المستودع' : 'Warehouse'}</label>
            <select className="select" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
              <option value="">—</option>
              {(warehouses || []).map((w) => (
                <option key={w._id} value={w._id}>{w.code || w.nameEn || w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'الموقع' : 'Location'}</label>
            <select className="select" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
              <option value="">—</option>
              {locs.map((l) => <option key={l._id} value={l._id}>{l.completePath}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Min</label>
            <input className="input" value={form.minQty} onChange={(e) => setForm({ ...form, minQty: e.target.value })} />
          </div>
          <div>
            <label className="label">Max</label>
            <input className="input" value={form.maxQty} onChange={(e) => setForm({ ...form, maxQty: e.target.value })} />
          </div>
          <div className="flex items-end">
            <button type="button" className="btn btn-primary btn-sm" disabled={mut.isPending} onClick={() => mut.mutate()}>
              <Plus className="h-4 w-4" />
              {language === 'ar' ? 'إضافة' : 'Add'}
            </button>
          </div>
        </div>
      </div>
      {items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2">{language === 'ar' ? 'المنتج' : 'Product'}</th>
                <th className="px-3 py-2">{language === 'ar' ? 'الموقع' : 'Location'}</th>
                <th className="px-3 py-2 text-right">Min</th>
                <th className="px-3 py-2 text-right">Max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.map((r) => (
                <tr key={r._id}>
                  <td className="px-3 py-2.5">{r.productId?.nameEn || r.productId?.sku || String(r.productId)}</td>
                  <td className="px-3 py-2.5">{r.locationId?.completePath || '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.minQty}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.maxQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ListShell>
  )
}

export function InventoryUomPage() {
  const { language } = useSelector((s) => s.ui)
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', categoryId: '', uomType: 'bigger', factor: '1' })

  const { data: cats } = useQuery({
    queryKey: ['inv-uom-categories'],
    queryFn: () => api.get('/stock/uom-categories').then((r) => r.data),
  })
  const { data: uoms, isLoading } = useQuery({
    queryKey: ['inv-uoms'],
    queryFn: () => api.get('/stock/uoms', { params: { active: 'false' } }).then((r) => r.data),
  })
  const rows = Array.isArray(uoms) ? uoms : []
  const categories = Array.isArray(cats) ? cats : []

  const mut = useMutation({
    mutationFn: () => api.post('/stock/uoms', form),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تمت الإضافة' : 'Added')
      setForm((f) => ({ ...f, name: '', factor: '1' }))
      qc.invalidateQueries({ queryKey: ['inv-uoms'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  return (
    <ListShell
      title={language === 'ar' ? 'الوحدات والتعبئة' : 'Units & Packagings'}
      subtitle={language === 'ar' ? 'وحدات القياس للمخزون' : 'Inventory units of measure'}
      loading={isLoading}
      empty={!rows.length && !isLoading ? <EmptyState title={language === 'ar' ? 'لا وحدات' : 'No units'} /> : null}
    >
      <div className="card grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
        <input className="input" placeholder={language === 'ar' ? 'الاسم' : 'Name'} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
          <option value="">{language === 'ar' ? 'الفئة' : 'Category'}</option>
          {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <input className="input" placeholder="Factor" value={form.factor} onChange={(e) => setForm({ ...form, factor: e.target.value })} />
        <button type="button" className="btn btn-primary btn-sm" disabled={mut.isPending || !form.name || !form.categoryId} onClick={() => mut.mutate()}>
          <Plus className="h-4 w-4" />
          {language === 'ar' ? 'إضافة' : 'Add'}
        </button>
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2">{language === 'ar' ? 'الاسم' : 'Name'}</th>
                <th className="px-3 py-2">{language === 'ar' ? 'النوع' : 'Type'}</th>
                <th className="px-3 py-2 text-right">Factor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {rows.map((u) => (
                <tr key={u._id}>
                  <td className="px-3 py-2.5 font-medium">{u.name}</td>
                  <td className="px-3 py-2.5">{u.uomType}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{u.factor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ListShell>
  )
}
