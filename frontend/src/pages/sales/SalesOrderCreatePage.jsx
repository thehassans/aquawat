import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import PartnerCombobox from '../../components/inventory/PartnerCombobox'
import AsyncCombobox from '../../components/ui/AsyncCombobox'
import VariantLineSelect from '../../components/inventory/VariantLineSelect'
import CustomerSummaryCard from '../../components/sales/CustomerSummaryCard'
import { useSalesSettings } from '../../context/SalesSettingsContext'
import { canViewSalesMargin, canOverrideSalesPrice } from '../../lib/salesPermissions'
import { INCOTERMS } from './salesConfig.menu'
import {
  fieldControlClass,
  fieldLabelClass,
  ghostActionClass,
  primaryActionClass,
  salesTableClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  sectionCardClass,
} from './salesUi'

const emptyLine = (taxRate = 15) => ({
  productId: '',
  variantId: '',
  manualName: '',
  productType: 'goods',
  quantityOrdered: '',
  unitCost: '',
  costPrice: '',
  taxRate,
  discountPercent: '',
  uomId: '',
  packagingId: '',
  packagingQty: 1,
  procurementRoute: 'mts',
  priceManuallyOverridden: false,
  product: null,
})

function lineMarginPct(line) {
  const price = Number(line.unitCost) || 0
  const cost = Number(line.costPrice) || 0
  if (price <= 0) return null
  return ((price - cost) / price) * 100
}

const numInputClass = `${fieldControlClass} text-end tabular-nums`

export default function SalesOrderCreatePage() {
  const navigate = useNavigate()
  const { language } = useSelector((s) => s.ui)
  const { tenant, user } = useSelector((s) => s.auth)
  const isAr = language === 'ar'
  const { showMarginsByDefault, showIncotermOnDocuments } = useSalesSettings()
  const displayMargin = canViewSalesMargin(user) && !!showMarginsByDefault
  const canOverridePrice = canOverrideSalesPrice(user)
  const defaultTax = Number(tenant?.settings?.taxRate ?? 15)

  const [customer, setCustomer] = useState(null)
  const [salesTeamId, setSalesTeamId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [warehouseOpt, setWarehouseOpt] = useState(null)
  const [incoterm, setIncoterm] = useState('EXW')
  const [promoCode, setPromoCode] = useState('')
  const [currencyRate, setCurrencyRate] = useState('1')
  const [lines, setLines] = useState([emptyLine(defaultTax)])

  const { data: settings } = useQuery({
    queryKey: ['sales-settings'],
    queryFn: async () => (await api.get('/sales/settings')).data,
  })

  const { data: teamsData } = useQuery({
    queryKey: ['sales-teams-active'],
    queryFn: async () => (await api.get('/sales/teams', { params: { isActive: true, limit: 100 } })).data,
    staleTime: 60_000,
  })
  const salesTeams = useMemo(() => {
    const raw = teamsData?.items || teamsData?.teams || teamsData || []
    return (Array.isArray(raw) ? raw : []).filter((t) => t.isActive !== false)
  }, [teamsData])

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
        salesTeamId: salesTeamId || undefined,
        warehouseId: warehouseId || undefined,
        incoterm: incoterm || settings?.defaultIncoterm || 'EXW',
        status: 'approved',
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
            procurementRoute: l.procurementRoute || 'mts',
            priceManuallyOverridden: Boolean(l.priceManuallyOverridden),
          }
        }),
      }
      return (await api.post('/purchase-orders', payload)).data
    },
    onSuccess: (order) => {
      if (order?.draftDelivery?.posted) {
        toast.success(isAr ? 'تم تأكيد أمر البيع وخصم المخزون' : 'Sales order confirmed — stock deducted')
      } else if (order?.draftDelivery?.stockError) {
        toast.error(
          isAr
            ? `أمر البيع أُنشئ لكن فشل خصم المخزون: ${order.draftDelivery.stockError}`
            : `Order created but stock-out failed: ${order.draftDelivery.stockError}`,
        )
      } else {
        toast.success(isAr ? 'تم إنشاء أمر البيع' : 'Sales order created')
      }
      navigate(`/app/dashboard/sales/orders/${order._id}`)
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  })

  const updateLine = (idx, patch) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const resolvePriceForLine = useCallback(async (idx, line, customerId) => {
    if (!line.productId) return
    try {
      const { data } = await api.post('/sales/pricing/resolve', {
        productId: line.productId,
        variantId: line.variantId || undefined,
        quantity: Number(line.quantityOrdered) || 1,
        basePrice: Number(line.product?.salePrice || line.unitCost || 0),
        cost: Number(line.costPrice || 0),
        partnerId: customerId || undefined,
        uomId: line.uomId || undefined,
        uomFactor: Number(line.packagingQty) || 1,
        currencyRate: Number(currencyRate) || 1,
        promoCode: promoCode.trim() || undefined,
        pricelistId: undefined,
        manualOverride: line.priceManuallyOverridden ? Number(line.unitCost) : null,
        hasMarginOverridePermission: canOverridePrice,
      })
      if (data?.unitPrice != null && !line.priceManuallyOverridden) {
        updateLine(idx, { unitCost: data.unitPrice })
      }
    } catch {
      /* keep catalog price */
    }
  }, [canOverridePrice, currencyRate, promoCode])

  const onLineGridKeyDown = (e, idx) => {
    const cells = e.currentTarget.closest('tr')?.querySelectorAll('input, select, [tabindex]')
    if (!cells?.length) return
    const list = [...cells]
    const i = list.indexOf(e.target)
    if (e.key === 'Enter') {
      e.preventDefault()
      if (idx === lines.length - 1) {
        setLines((p) => [...p, emptyLine(defaultTax)])
      }
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        if (i > 0) list[i - 1].focus()
        else {
          const prevRow = e.currentTarget.closest('tbody')?.children?.[idx - 1]
          const prevCells = prevRow?.querySelectorAll('input, select')
          if (prevCells?.length) prevCells[prevCells.length - 1].focus()
        }
      } else if (i >= 0 && i < list.length - 1) {
        list[i + 1].focus()
      } else {
        if (idx === lines.length - 1) setLines((p) => [...p, emptyLine(defaultTax)])
        const nextRow = e.currentTarget.closest('tbody')?.children?.[idx + 1]
        nextRow?.querySelector('input, select')?.focus()
      }
      return
    }
    if (e.key === 'ArrowDown' && !e.altKey) {
      e.preventDefault()
      const nextRow = e.currentTarget.closest('tbody')?.children?.[idx + 1]
      const nextCells = nextRow?.querySelectorAll('input, select')
      if (nextCells?.[i]) nextCells[i].focus()
      else nextRow?.querySelector('input, select')?.focus()
    }
    if (e.key === 'ArrowUp' && !e.altKey) {
      e.preventDefault()
      const prevRow = e.currentTarget.closest('tbody')?.children?.[idx - 1]
      const prevCells = prevRow?.querySelectorAll('input, select')
      if (prevCells?.[i]) prevCells[i].focus()
      else prevRow?.querySelector('input, select')?.focus()
    }
    if (e.key === 'ArrowRight' && e.altKey && i >= 0 && i < list.length - 1) {
      e.preventDefault()
      list[i + 1].focus()
    }
    if (e.key === 'ArrowLeft' && e.altKey && i > 0) {
      e.preventDefault()
      list[i - 1].focus()
    }
  }

  const colCount = displayMargin ? 11 : 10

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          className={`${primaryActionClass} !px-4 !py-2.5 !text-sm disabled:opacity-40`}
          disabled={!customer?._id || !warehouseId || save.isPending}
          onClick={() => {
            if (!warehouseId) {
              toast.error(isAr ? 'المخزن مطلوب لخصم المخزون' : 'Warehouse is required to deduct stock')
              return
            }
            save.mutate()
          }}
        >
          {save.isPending ? '…' : (isAr ? 'تأكيد وخصم المخزون' : 'Confirm & deduct stock')}
        </button>
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

        <div className={`grid gap-4 ${showIncotermOnDocuments ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          <div>
            <label className={fieldLabelClass}>{isAr ? 'فريق المبيعات' : 'Sales team'}</label>
            <select
              className={fieldControlClass}
              value={salesTeamId}
              onChange={(e) => setSalesTeamId(e.target.value)}
            >
              <option value="">{isAr ? 'بدون فريق' : 'No team'}</option>
              {salesTeams.map((t) => (
                <option key={t._id} value={t._id}>
                  {isAr ? (t.nameAr || t.name) : (t.name || t.nameAr)}
                  {t.teamType ? ` · ${t.teamType}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={fieldLabelClass}>{isAr ? 'المخزن *' : 'Warehouse *'}</label>
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
          {showIncotermOnDocuments ? (
            <div>
              <label className={fieldLabelClass}>Incoterm</label>
              <select className={fieldControlClass} value={incoterm} onChange={(e) => setIncoterm(e.target.value)}>
                {INCOTERMS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          ) : null}
          <div>
            <label className={fieldLabelClass}>{isAr ? 'كود عرض' : 'Promo code'}</label>
            <input
              className={fieldControlClass}
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              onBlur={() => {
                lines.forEach((line, idx) => {
                  if (line.productId && !line.priceManuallyOverridden) {
                    resolvePriceForLine(idx, line, customer?._id)
                  }
                })
              }}
              placeholder="SAVE10"
            />
          </div>
          <div>
            <label className={fieldLabelClass}>{isAr ? 'سعر الصرف' : 'FX rate'}</label>
            <input
              type="number"
              min={0}
              step="0.0001"
              className={numInputClass}
              value={currencyRate}
              onChange={(e) => setCurrencyRate(e.target.value)}
              onBlur={() => {
                lines.forEach((line, idx) => {
                  if (line.productId && !line.priceManuallyOverridden) {
                    resolvePriceForLine(idx, line, customer?._id)
                  }
                })
              }}
            />
          </div>
        </div>
      </div>

      <div className={`${sectionCardClass} !p-0 overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-slate-200/90 px-5 py-3.5 dark:border-dark-600">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            {isAr ? 'البنود' : 'Lines'}
          </h2>
          <button type="button" className={ghostActionClass} onClick={() => setLines((p) => [...p, emptyLine(defaultTax)])}>
            <Plus className="h-3.5 w-3.5" /> {isAr ? 'سطر' : 'Add line'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className={`${salesTableClass} min-w-[920px]`}>
            <thead>
              <tr>
                <th className={`${salesThClass} w-[28%]`}>{isAr ? 'المنتج' : 'Product'}</th>
                <th className={`${salesThClass} w-[12%]`}>{isAr ? 'المتغير' : 'Variant'}</th>
                <th className={`${salesThClass} w-[8%]`}>{isAr ? 'الوحدة' : 'UoM'}</th>
                <th className={`${salesThClass} w-[10%]`}>{isAr ? 'التعبئة' : 'Pack'}</th>
                <th className={`${salesThClass} w-[8%] text-end`}>{isAr ? 'الكمية' : 'Qty'}</th>
                <th className={`${salesThClass} w-[10%] text-end`}>{isAr ? 'السعر' : 'Price'}</th>
                <th className={`${salesThClass} w-[8%] text-end`}>{isAr ? 'خصم %' : 'Disc %'}</th>
                <th className={`${salesThClass} w-[8%] text-end`}>{isAr ? 'ضريبة %' : 'Tax %'}</th>
                <th className={`${salesThClass} w-[8%]`}>{isAr ? 'المسار' : 'Route'}</th>
                {displayMargin ? (
                  <th className={`${salesThClass} w-[8%] text-end`}>{isAr ? 'هامش' : 'Margin'}</th>
                ) : null}
                <th className={`${salesThClass} w-12`} />
              </tr>
            </thead>
            <tbody>
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
                  customerId={customer?._id}
                  onChange={(patch) => updateLine(idx, patch)}
                  onResolvePrice={() => resolvePriceForLine(idx, lines[idx], customer?._id)}
                  onKeyDown={(e) => onLineGridKeyDown(e, idx)}
                  onRemove={() => setLines((p) => p.filter((_, i) => i !== idx))}
                />
              ))}
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className={`${salesTdClass} text-center text-slate-400`}>
                    {isAr ? 'لا توجد بنود' : 'No lines'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SoLineRow({
  line,
  idx,
  isAr,
  uoms,
  displayMargin,
  canRemove,
  fetchProducts,
  customerId,
  onChange,
  onResolvePrice,
  onKeyDown,
  onRemove,
}) {
  const { data: packsData } = useQuery({
    queryKey: ['sales-packagings', line.productId],
    queryFn: async () => (await api.get('/sales/product-packagings', { params: { productId: line.productId } })).data,
    enabled: Boolean(line.productId),
    staleTime: 30_000,
  })
  const packs = packsData?.items || []
  const margin = lineMarginPct(line)

  return (
    <tr className={salesTrClass} onKeyDown={onKeyDown}>
      <td className={`${salesTdClass} !py-2.5`}>
        <AsyncCombobox
          value={line.productId}
          selectedOption={line.product}
          onChange={async (id, opt) => {
            const next = {
              productId: id || '',
              product: opt,
              manualName: opt?.name || '',
              unitCost: opt?.salePrice != null && Number(opt.salePrice) > 0 ? opt.salePrice : '',
              costPrice: opt?.costPrice ?? '',
              productType: opt?.productType || 'goods',
              taxRate: opt?.taxRate ?? line.taxRate,
              uomId: opt?.uomId || '',
              packagingId: '',
              packagingQty: 1,
              variantId: '',
              priceManuallyOverridden: false,
              quantityOrdered: line.quantityOrdered === '' ? 1 : line.quantityOrdered,
            }
            onChange(next)
            if (id) {
              setTimeout(() => onResolvePrice?.(), 0)
            }
          }}
          fetchOptions={fetchProducts}
          queryKeyPrefix={`so-prod-${idx}`}
          placeholder={isAr ? 'بحث المنتج…' : 'Search product…'}
        />
      </td>
      <td className={`${salesTdClass} !py-2.5`}>
        <VariantLineSelect
          productId={line.productId}
          value={line.variantId}
          language={isAr ? 'ar' : 'en'}
          required
          onChange={(vid, variant) => {
            onChange({
              variantId: vid || '',
              priceManuallyOverridden: false,
              ...(variant?.price != null && Number(variant.price) > 0
                ? { unitCost: Number(variant.price) }
                : {}),
            })
            setTimeout(() => onResolvePrice?.(), 0)
          }}
        />
      </td>
      <td className={`${salesTdClass} !py-2.5`}>
        <select
          className={fieldControlClass}
          value={line.uomId || ''}
          onChange={(e) => {
            onChange({ uomId: e.target.value, priceManuallyOverridden: false })
            setTimeout(() => onResolvePrice?.(), 0)
          }}
        >
          <option value="">{line.product?.uomLabel || '—'}</option>
          {uoms.map((u) => (
            <option key={u._id} value={u._id}>{isAr && u.nameAr ? u.nameAr : u.name}</option>
          ))}
        </select>
      </td>
      <td className={`${salesTdClass} !py-2.5`}>
        <select
          className={fieldControlClass}
          value={line.packagingId || ''}
          disabled={!packs.length}
          onChange={(e) => {
            const id = e.target.value
            const pack = packs.find((p) => String(p._id) === String(id))
            onChange({ packagingId: id, packagingQty: Number(pack?.qty) || 1, priceManuallyOverridden: false })
            setTimeout(() => onResolvePrice?.(), 0)
          }}
        >
          <option value="">—</option>
          {packs.map((p) => (
            <option key={p._id} value={p._id}>{p.name} (×{p.qty})</option>
          ))}
        </select>
      </td>
      <td className={`${salesTdClass} !py-2.5`}>
        <input
          type="number"
          min={0}
          className={numInputClass}
          value={line.quantityOrdered}
          onChange={(e) => onChange({ quantityOrdered: e.target.value, priceManuallyOverridden: false })}
          onBlur={() => onResolvePrice?.()}
          placeholder="0"
        />
      </td>
      <td className={`${salesTdClass} !py-2.5`}>
        <input
          type="number"
          min={0}
          step="0.01"
          className={numInputClass}
          value={line.unitCost}
          onChange={(e) => onChange({ unitCost: e.target.value, priceManuallyOverridden: true })}
          placeholder="0"
        />
      </td>
      <td className={`${salesTdClass} !py-2.5`}>
        <input
          type="number"
          min={0}
          max={100}
          className={numInputClass}
          value={line.discountPercent}
          onChange={(e) => onChange({ discountPercent: e.target.value })}
          placeholder="0"
        />
      </td>
      <td className={`${salesTdClass} !py-2.5`}>
        <input
          type="number"
          min={0}
          className={numInputClass}
          value={line.taxRate}
          onChange={(e) => onChange({ taxRate: e.target.value })}
        />
      </td>
      <td className={`${salesTdClass} !py-2.5`}>
        <select
          className={fieldControlClass}
          value={line.procurementRoute || 'mts'}
          onChange={(e) => onChange({ procurementRoute: e.target.value })}
          title={customerId ? '' : undefined}
        >
          <option value="mts">MTS</option>
          <option value="mto">MTO</option>
          <option value="dropship">Dropship</option>
        </select>
      </td>
      {displayMargin ? (
        <td className={`${salesTdClass} !py-2.5 text-end tabular-nums`}>
          {margin == null ? '—' : `${margin.toFixed(1)}%`}
        </td>
      ) : null}
      <td className={`${salesTdClass} !py-2.5`}>
        <button type="button" className={ghostActionClass} disabled={!canRemove} onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}
