import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import PartnerCombobox from '../../components/inventory/PartnerCombobox'
import AsyncCombobox from '../../components/ui/AsyncCombobox'
import VariantLineSelect from '../../components/inventory/VariantLineSelect'
import CustomerSummaryCard from '../../components/sales/CustomerSummaryCard'
import { useSalesSettings } from '../../context/SalesSettingsContext'
import { canViewSalesMargin } from '../../lib/salesPermissions'
import { INCOTERMS } from './salesConfig.menu'
import {
  backBtnClass,
  fieldControlClass,
  fieldLabelClass,
  ghostActionClass,
  pageSubtitleClass,
  pageTitleClass,
  sectionCardClass,
} from './salesUi'

const emptyLine = () => ({
  productId: '',
  variantId: '',
  manualName: '',
  productType: 'goods',
  quantityOrdered: 1,
  unitCost: 0,
  costPrice: 0,
  taxRate: 15,
  discountPercent: 0,
  uomId: '',
  packagingId: '',
  packagingQty: 1,
  product: null,
})

function lineMarginPct(line) {
  const price = Number(line.unitCost) || 0
  const cost = Number(line.costPrice) || 0
  if (price <= 0) return null
  return ((price - cost) / price) * 100
}

export default function SalesOrderCreatePage() {
  const navigate = useNavigate()
  const { language } = useSelector((s) => s.ui)
  const { tenant, user } = useSelector((s) => s.auth)
  const isAr = language === 'ar'
  const { showMarginsByDefault } = useSalesSettings()
  const displayMargin = canViewSalesMargin(user) && !!showMarginsByDefault

  const [customer, setCustomer] = useState(null)
  const [warehouseId, setWarehouseId] = useState('')
  const [warehouseOpt, setWarehouseOpt] = useState(null)
  const [incoterm, setIncoterm] = useState('EXW')
  const [lines, setLines] = useState([emptyLine()])

  const { data: settings } = useQuery({
    queryKey: ['sales-settings'],
    queryFn: async () => (await api.get('/sales/settings')).data,
  })

  const { data: uomsData } = useQuery({
    queryKey: ['sales-uoms'],
    queryFn: async () => (await api.get('/sales/uoms')).data,
    staleTime: 60_000,
  })
  const uoms = useMemo(() => uomsData?.items || [], [uomsData])

  const fetchWarehouses = useCallback(async (q) => {
    const { data } = await api.get('/warehouses', { params: { search: q, limit: 20, isActive: true } })
    const list = data?.warehouses || data?.items || data || []
    return (Array.isArray(list) ? list : []).map((w) => ({
      _id: w._id,
      name: w.nameEn || w.name || w.code,
      sub: w.code,
    }))
  }, [])

  const fetchProducts = useCallback(async (q) => {
    const { data } = await api.get('/products', { params: { search: q, limit: 20, isActive: true } })
    const list = data?.products || data?.items || data || []
    return (Array.isArray(list) ? list : []).map((p) => ({
      _id: p._id,
      name: p.nameEn || p.name || p.sku,
      sub: p.sku,
      salePrice: p.salePrice ?? p.sellingPrice ?? p.price ?? 0,
      costPrice: p.costPrice ?? p.purchasePrice ?? 0,
      productType: p.productType || 'goods',
      taxRate: p.taxRate ?? tenant?.settings?.taxRate ?? 15,
      uomId: p.uomId?._id || p.uomId || '',
      uomLabel: p.uomId?.name || p.unitOfMeasure || '',
    }))
  }, [tenant])

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        flow: 'sell',
        customerId: customer?._id,
        warehouseId: warehouseId || undefined,
        incoterm: incoterm || settings?.defaultIncoterm || 'EXW',
        currency: tenant?.settings?.currency || 'SAR',
        lineItems: lines.map((l) => {
          const uom = uoms.find((u) => String(u._id) === String(l.uomId))
          return {
            productId: l.productId || undefined,
            variantId: l.variantId || undefined,
            manualName: l.manualName || l.product?.name || 'Item',
            productType: l.productType || 'goods',
            quantityOrdered: Number(l.quantityOrdered) || 0,
            unitCost: Number(l.unitCost) || 0,
            taxRate: Number(l.taxRate) || 0,
            discountPercent: Number(l.discountPercent) || 0,
            uomId: l.uomId || undefined,
            uom: uom?.name || l.product?.uomLabel || '',
            packagingId: l.packagingId || undefined,
            packagingQty: Number(l.packagingQty) || 1,
          }
        }),
      }
      return (await api.post('/purchase-orders', payload)).data
    },
    onSuccess: (order) => {
      toast.success(isAr ? 'تم إنشاء أمر البيع' : 'Sales order created')
      navigate(`/app/dashboard/sales/orders/${order._id}`)
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  })

  const updateLine = (idx, patch) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" className={backBtnClass} onClick={() => navigate('/app/dashboard/sales/orders')}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className={pageTitleClass}>{isAr ? 'أمر بيع جديد' : 'New sales order'}</h1>
          <p className={pageSubtitleClass}>{isAr ? 'عميل، مخزن، بنود، Incoterm' : 'Customer, warehouse, lines, and incoterm'}</p>
        </div>
      </div>

      <div className={`${sectionCardClass} space-y-4`}>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'العميل' : 'Customer'}</label>
          <PartnerCombobox
            role="customer"
            value={customer?._id || ''}
            selectedOption={customer}
            language={language}
            ar={isAr}
            onChange={(_id, opt) => setCustomer(opt || null)}
          />
        </div>
        {customer?._id ? <CustomerSummaryCard customer={customer} language={language} onEdit={() => setCustomer(null)} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={fieldLabelClass}>{isAr ? 'المخزن' : 'Warehouse'}</label>
            <AsyncCombobox
              value={warehouseId}
              selectedOption={warehouseOpt}
              onChange={(id, opt) => { setWarehouseId(id || ''); setWarehouseOpt(opt || null) }}
              fetchOptions={fetchWarehouses}
              queryKeyPrefix="so-wh"
              placeholder={isAr ? 'بحث المخزن…' : 'Search warehouse…'}
              minChars={0}
            />
          </div>
          <div>
            <label className={fieldLabelClass}>Incoterm</label>
            <select className={fieldControlClass} value={incoterm} onChange={(e) => setIncoterm(e.target.value)}>
              {INCOTERMS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className={`${sectionCardClass} space-y-3`}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{isAr ? 'البنود' : 'Order lines'}</h2>
          <button type="button" className={ghostActionClass} onClick={() => setLines((p) => [...p, emptyLine()])}>
            <Plus className="h-3.5 w-3.5" /> {isAr ? 'سطر' : 'Add line'}
          </button>
        </div>
        {lines.map((line, idx) => (
          <SoLineRow
            key={idx}
            line={line}
            idx={idx}
            isAr={isAr}
            uoms={uoms}
            displayMargin={displayMargin}
            canRemove={lines.length > 1}
            fetchProducts={fetchProducts}
            onChange={(patch) => updateLine(idx, patch)}
            onRemove={() => setLines((p) => p.filter((_, i) => i !== idx))}
          />
        ))}
      </div>

      <button
        type="button"
        className="btn btn-primary"
        disabled={!customer?._id || save.isPending}
        onClick={() => save.mutate()}
      >
        {save.isPending ? '…' : (isAr ? 'حفظ أمر البيع' : 'Create sales order')}
      </button>
    </div>
  )
}

function SoLineRow({ line, idx, isAr, uoms, displayMargin, canRemove, fetchProducts, onChange, onRemove }) {
  const { data: packsData } = useQuery({
    queryKey: ['sales-packagings', line.productId],
    queryFn: async () => (await api.get('/sales/product-packagings', { params: { productId: line.productId } })).data,
    enabled: Boolean(line.productId),
    staleTime: 30_000,
  })
  const packs = packsData?.items || []
  const margin = lineMarginPct(line)

  return (
    <div className="grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-dark-600 sm:grid-cols-12">
      <div className="sm:col-span-3">
        <AsyncCombobox
          value={line.productId}
          selectedOption={line.product}
          onChange={(id, opt) => onChange({
            productId: id || '',
            product: opt,
            manualName: opt?.name || '',
            unitCost: opt?.salePrice ?? line.unitCost,
            costPrice: opt?.costPrice ?? 0,
            productType: opt?.productType || 'goods',
            taxRate: opt?.taxRate ?? line.taxRate,
            uomId: opt?.uomId || '',
            packagingId: '',
            packagingQty: 1,
            variantId: '',
          })}
          fetchOptions={fetchProducts}
          queryKeyPrefix={`so-prod-${idx}`}
          placeholder={isAr ? 'بحث المنتج…' : 'Search product…'}
        />
      </div>
      <div className="sm:col-span-2">
        <VariantLineSelect
          productId={line.productId}
          value={line.variantId}
          onChange={(vid) => onChange({ variantId: vid || '' })}
        />
      </div>
      <div className="sm:col-span-1">
        <select
          className={fieldControlClass}
          value={line.uomId || ''}
          onChange={(e) => onChange({ uomId: e.target.value })}
          title={isAr ? 'وحدة القياس' : 'UoM'}
        >
          <option value="">{line.product?.uomLabel || (isAr ? 'وحدة' : 'UoM')}</option>
          {uoms.map((u) => (
            <option key={u._id} value={u._id}>{isAr && u.nameAr ? u.nameAr : u.name}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-1">
        <select
          className={fieldControlClass}
          value={line.packagingId || ''}
          disabled={!packs.length}
          onChange={(e) => {
            const id = e.target.value
            const pack = packs.find((p) => String(p._id) === String(id))
            onChange({ packagingId: id, packagingQty: Number(pack?.qty) || 1 })
          }}
          title={isAr ? 'التعبئة' : 'Packaging'}
        >
          <option value="">{isAr ? 'تعبئة' : 'Pack'}</option>
          {packs.map((p) => (
            <option key={p._id} value={p._id}>{p.name} (×{p.qty})</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-1">
        <input type="number" min={0} className={fieldControlClass} value={line.quantityOrdered} onChange={(e) => onChange({ quantityOrdered: e.target.value })} placeholder="Qty" />
      </div>
      <div className="sm:col-span-1">
        <input type="number" min={0} className={fieldControlClass} value={line.unitCost} onChange={(e) => onChange({ unitCost: e.target.value })} placeholder="Price" />
      </div>
      <div className="sm:col-span-1">
        <input type="number" min={0} max={100} className={fieldControlClass} value={line.discountPercent} onChange={(e) => onChange({ discountPercent: e.target.value })} placeholder="% Disc" />
      </div>
      <div className="sm:col-span-1">
        <input type="number" className={fieldControlClass} value={line.taxRate} onChange={(e) => onChange({ taxRate: e.target.value })} placeholder="Tax%" />
      </div>
      {displayMargin ? (
        <div className="flex items-center justify-end sm:col-span-1">
          <span
            className={`text-xs font-semibold tabular-nums ${margin != null && margin < 0 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}`}
            title={isAr ? 'هامش الربح %' : 'Margin %'}
          >
            {margin == null ? '—' : `${margin.toFixed(1)}%`}
          </span>
        </div>
      ) : null}
      <div className="flex items-center sm:col-span-1">
        <button type="button" className="text-red-500" disabled={!canRemove} onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
