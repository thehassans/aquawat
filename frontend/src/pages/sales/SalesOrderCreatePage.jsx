import { useCallback, useState } from 'react'
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
  taxRate: 15,
  discountPercent: 0,
  product: null,
})

export default function SalesOrderCreatePage() {
  const navigate = useNavigate()
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const isAr = language === 'ar'

  const [customer, setCustomer] = useState(null)
  const [warehouseId, setWarehouseId] = useState('')
  const [warehouseOpt, setWarehouseOpt] = useState(null)
  const [incoterm, setIncoterm] = useState('EXW')
  const [lines, setLines] = useState([emptyLine()])

  const { data: settings } = useQuery({
    queryKey: ['sales-settings'],
    queryFn: async () => (await api.get('/sales/settings')).data,
  })

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
      productType: p.productType || 'goods',
      taxRate: p.taxRate ?? tenant?.settings?.taxRate ?? 15,
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
        lineItems: lines.map((l) => ({
          productId: l.productId || undefined,
          variantId: l.variantId || undefined,
          manualName: l.manualName || l.product?.name || 'Item',
          productType: l.productType || 'goods',
          quantityOrdered: Number(l.quantityOrdered) || 0,
          unitCost: Number(l.unitCost) || 0,
          taxRate: Number(l.taxRate) || 0,
          discountPercent: Number(l.discountPercent) || 0,
        })),
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
            onChange={(id, opt) => setCustomer(opt || null)}
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
          <div key={idx} className="grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-dark-600 sm:grid-cols-12">
            <div className="sm:col-span-4">
              <AsyncCombobox
                value={line.productId}
                selectedOption={line.product}
                onChange={(id, opt) => updateLine(idx, {
                  productId: id || '',
                  product: opt,
                  manualName: opt?.name || '',
                  unitCost: opt?.salePrice ?? line.unitCost,
                  productType: opt?.productType || 'goods',
                  taxRate: opt?.taxRate ?? line.taxRate,
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
                onChange={(vid) => updateLine(idx, { variantId: vid || '' })}
              />
            </div>
            <div className="sm:col-span-1">
              <input type="number" min={0} className={fieldControlClass} value={line.quantityOrdered} onChange={(e) => updateLine(idx, { quantityOrdered: e.target.value })} placeholder="Qty" />
            </div>
            <div className="sm:col-span-2">
              <input type="number" min={0} className={fieldControlClass} value={line.unitCost} onChange={(e) => updateLine(idx, { unitCost: e.target.value })} placeholder="Price" />
            </div>
            <div className="sm:col-span-1">
              <input type="number" min={0} max={100} className={fieldControlClass} value={line.discountPercent} onChange={(e) => updateLine(idx, { discountPercent: e.target.value })} placeholder="% Disc" />
            </div>
            <div className="sm:col-span-1">
              <input type="number" className={fieldControlClass} value={line.taxRate} onChange={(e) => updateLine(idx, { taxRate: e.target.value })} placeholder="Tax%" />
            </div>
            <div className="flex items-center sm:col-span-1">
              <button type="button" className="text-red-500" disabled={lines.length === 1} onClick={() => setLines((p) => p.filter((_, i) => i !== idx))}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
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
