import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'
import api from '../../../lib/api'
import AsyncCombobox from '../../../components/ui/AsyncCombobox'
import VariantLineSelect from '../../../components/inventory/VariantLineSelect'
import {
  fieldControlClass,
  fieldLabelClass,
  ghostActionClass,
  listShellClass,
  pageSubtitleClass,
  primaryActionClass,
  salesTableClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  sectionCardClass,
} from '../salesUi'

const emptyItem = () => ({
  productId: '',
  product: null,
  variantId: '',
  uomId: '',
  fixedPrice: '',
  minQuantity: 1,
  uomFactor: 1,
  validFrom: '',
  validTo: '',
  partnerIdsText: '',
})

function productOptionFromId(it) {
  const p = it.productId
  if (p && typeof p === 'object') {
    return { _id: p._id, name: p.nameEn || p.name || p.sku || String(p._id), sub: p.sku }
  }
  if (it.product) return it.product
  if (it.productId) return { _id: it.productId, name: String(it.productId) }
  return null
}

export default function PricelistsPage() {
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const qc = useQueryClient()
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    name: '',
    nameAr: '',
    currency: 'SAR',
    isDefault: false,
    validFrom: '',
    validTo: '',
    items: [emptyItem()],
  })

  const { data, isLoading } = useQuery({
    queryKey: ['sales-config', '/sales/pricelists'],
    queryFn: async () => {
      const { data: res } = await api.get('/sales/pricelists')
      return res.items || res || []
    },
  })
  const items = useMemo(() => (Array.isArray(data) ? data : []), [data])

  const fetchProducts = useCallback(async (q) => {
    const { data: res } = await api.get('/products', { params: { search: q, limit: 20, isActive: true } })
    const list = res?.products || res?.items || res || []
    return (Array.isArray(list) ? list : []).map((p) => ({
      _id: p._id,
      name: p.nameEn || p.name || p.sku,
      sub: p.sku,
    }))
  }, [])

  const reset = () => {
    setEditingId(null)
    setForm({
      name: '',
      nameAr: '',
      currency: 'SAR',
      isDefault: false,
      validFrom: '',
      validTo: '',
      items: [emptyItem()],
    })
  }

  const startEdit = (row) => {
    setEditingId(row._id)
    setForm({
      name: row.name || '',
      nameAr: row.nameAr || '',
      currency: row.currency || 'SAR',
      isDefault: !!row.isDefault,
      validFrom: row.validFrom ? String(row.validFrom).slice(0, 10) : '',
      validTo: row.validTo ? String(row.validTo).slice(0, 10) : '',
      items: (row.items || []).length
        ? row.items.map((it) => {
            const product = productOptionFromId(it)
            const variant = it.variantId && typeof it.variantId === 'object' ? it.variantId : null
            return {
              productId: product?._id || it.productId?._id || it.productId || '',
              product,
              variantId: variant?._id || it.variantId || '',
              uomId: it.uomId?._id || it.uomId || '',
              fixedPrice: it.fixedPrice ?? '',
              minQuantity: it.minQuantity ?? 1,
              uomFactor: it.uomFactor ?? 1,
              validFrom: it.validFrom ? String(it.validFrom).slice(0, 10) : '',
              validTo: it.validTo ? String(it.validTo).slice(0, 10) : '',
              partnerIdsText: (it.partnerIds || []).map((id) => (id?._id || id)).map(String).join(','),
            }
          })
        : [emptyItem()],
    })
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        nameAr: form.nameAr,
        currency: form.currency,
        isDefault: form.isDefault,
        validFrom: form.validFrom || null,
        validTo: form.validTo || null,
        items: (form.items || [])
          .filter((it) => it.productId)
          .map((it) => ({
            productId: it.productId,
            variantId: it.variantId || null,
            uomId: it.uomId || null,
            fixedPrice: it.fixedPrice === '' ? null : Number(it.fixedPrice),
            minQuantity: Number(it.minQuantity) || 1,
            uomFactor: Number(it.uomFactor) || 1,
            validFrom: it.validFrom || null,
            validTo: it.validTo || null,
            partnerIds: String(it.partnerIdsText || '')
              .split(/[,\s]+/)
              .map((s) => s.trim())
              .filter(Boolean),
          })),
      }
      if (editingId) return (await api.put(`/sales/pricelists/${editingId}`, payload)).data
      return (await api.post('/sales/pricelists', payload)).data
    },
    onSuccess: () => {
      toast.success(isAr ? 'تم الحفظ' : 'Saved')
      reset()
      qc.invalidateQueries({ queryKey: ['sales-config', '/sales/pricelists'] })
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  })

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/sales/pricelists/${id}`),
    onSuccess: () => {
      toast.success(isAr ? 'تم الحذف' : 'Deleted')
      qc.invalidateQueries({ queryKey: ['sales-config', '/sales/pricelists'] })
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  })

  const setItem = (idx, patch) => {
    setForm((p) => ({
      ...p,
      items: p.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {isAr ? 'قوائم الأسعار' : 'Pricelists'}
        </h2>
        <p className={pageSubtitleClass}>
          {isAr
            ? 'أسعار حسب المنتج والمتغير والكمية مع نوافذ صلاحية'
            : 'Product, variant, volume, and UoM prices with validity windows'}
        </p>
      </div>

      <div className={`${sectionCardClass} space-y-4`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={fieldLabelClass}>{isAr ? 'الاسم' : 'Name'}</label>
            <input className={fieldControlClass} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className={fieldLabelClass}>{isAr ? 'الاسم عربي' : 'Name (AR)'}</label>
            <input className={fieldControlClass} value={form.nameAr} onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))} />
          </div>
          <div>
            <label className={fieldLabelClass}>{isAr ? 'العملة' : 'Currency'}</label>
            <input className={fieldControlClass} value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} />
          </div>
          <div>
            <label className={fieldLabelClass}>{isAr ? 'من تاريخ' : 'Valid from'}</label>
            <input type="date" className={fieldControlClass} value={form.validFrom} onChange={(e) => setForm((p) => ({ ...p, validFrom: e.target.value }))} />
          </div>
          <div>
            <label className={fieldLabelClass}>{isAr ? 'إلى تاريخ' : 'Valid to'}</label>
            <input type="date" className={fieldControlClass} value={form.validTo} onChange={(e) => setForm((p) => ({ ...p, validTo: e.target.value }))} />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))} />
            {isAr ? 'افتراضي' : 'Default pricelist'}
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className={`${salesTableClass} min-w-[860px]`}>
            <thead>
              <tr>
                <th className={salesThClass}>{isAr ? 'المنتج' : 'Product'}</th>
                <th className={salesThClass}>{isAr ? 'المتغير' : 'Variant'}</th>
                <th className={salesThClass}>{isAr ? 'السعر' : 'Price'}</th>
                <th className={salesThClass}>{isAr ? 'حد الكمية' : 'Min qty'}</th>
                <th className={salesThClass}>{isAr ? 'معامل الوحدة' : 'UoM factor'}</th>
                <th className={salesThClass}>{isAr ? 'عملاء (IDs)' : 'Partner IDs'}</th>
                <th className={salesThClass}>{isAr ? 'من' : 'From'}</th>
                <th className={salesThClass}>{isAr ? 'إلى' : 'To'}</th>
                <th className={salesThClass} />
              </tr>
            </thead>
            <tbody>
              {form.items.map((it, idx) => (
                <tr key={idx} className={salesTrClass}>
                  <td className={`${salesTdClass} min-w-[200px]`}>
                    <AsyncCombobox
                      value={it.productId}
                      selectedOption={it.product}
                      onChange={(id, opt) => setItem(idx, {
                        productId: id || '',
                        product: opt || null,
                        variantId: '',
                      })}
                      fetchOptions={fetchProducts}
                      queryKeyPrefix={`pricelist-prod-${idx}`}
                      placeholder={isAr ? 'بحث المنتج…' : 'Search product…'}
                      minChars={0}
                    />
                  </td>
                  <td className={`${salesTdClass} min-w-[160px]`}>
                    <VariantLineSelect
                      productId={it.productId}
                      value={it.variantId}
                      language={isAr ? 'ar' : 'en'}
                      autoSelectSingle={false}
                      onChange={(vid) => setItem(idx, { variantId: vid || '' })}
                    />
                  </td>
                  <td className={salesTdClass}>
                    <input type="number" className={fieldControlClass} value={it.fixedPrice} onChange={(e) => setItem(idx, { fixedPrice: e.target.value })} />
                  </td>
                  <td className={salesTdClass}>
                    <input type="number" className={fieldControlClass} value={it.minQuantity} onChange={(e) => setItem(idx, { minQuantity: e.target.value })} />
                  </td>
                  <td className={salesTdClass}>
                    <input type="number" className={fieldControlClass} value={it.uomFactor} onChange={(e) => setItem(idx, { uomFactor: e.target.value })} />
                  </td>
                  <td className={salesTdClass}>
                    <input className={fieldControlClass} value={it.partnerIdsText} onChange={(e) => setItem(idx, { partnerIdsText: e.target.value })} placeholder="id,id" />
                  </td>
                  <td className={salesTdClass}>
                    <input type="date" className={fieldControlClass} value={it.validFrom} onChange={(e) => setItem(idx, { validFrom: e.target.value })} />
                  </td>
                  <td className={salesTdClass}>
                    <input type="date" className={fieldControlClass} value={it.validTo} onChange={(e) => setItem(idx, { validTo: e.target.value })} />
                  </td>
                  <td className={salesTdClass}>
                    <button type="button" className={ghostActionClass} disabled={form.items.length <= 1} onClick={() => setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={ghostActionClass} onClick={() => setForm((p) => ({ ...p, items: [...p.items, emptyItem()] }))}>
            <Plus className="h-3.5 w-3.5" /> {isAr ? 'بند سعر' : 'Add item'}
          </button>
          <button type="button" className={primaryActionClass} disabled={!form.name || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? '…' : (editingId ? (isAr ? 'تحديث' : 'Update') : (isAr ? 'إنشاء' : 'Create'))}
          </button>
          {editingId ? (
            <button type="button" className={ghostActionClass} onClick={reset}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          ) : null}
        </div>
      </div>

      <div className={listShellClass}>
        {isLoading ? <p className="p-4 text-sm text-slate-400">…</p> : null}
        <table className={salesTableClass}>
          <thead>
            <tr>
              <th className={salesThClass}>{isAr ? 'الاسم' : 'Name'}</th>
              <th className={salesThClass}>{isAr ? 'العملة' : 'Currency'}</th>
              <th className={salesThClass}>{isAr ? 'البنود' : 'Items'}</th>
              <th className={salesThClass}>{isAr ? 'الصلاحية' : 'Validity'}</th>
              <th className={salesThClass} />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row._id} className={salesTrClass}>
                <td className={salesTdClass}>{row.name}{row.isDefault ? ' ★' : ''}</td>
                <td className={salesTdClass}>{row.currency}</td>
                <td className={salesTdClass}>{row.items?.length ?? 0}</td>
                <td className={salesTdClass}>
                  {[row.validFrom, row.validTo].filter(Boolean).map((d) => String(d).slice(0, 10)).join(' → ') || '—'}
                </td>
                <td className={`${salesTdClass} space-x-2`}>
                  <button type="button" className={ghostActionClass} onClick={() => startEdit(row)}>{isAr ? 'تعديل' : 'Edit'}</button>
                  <button type="button" className={ghostActionClass} onClick={() => remove.mutate(row._id)}>{isAr ? 'حذف' : 'Delete'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
