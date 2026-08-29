import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Plus, Trash2, Receipt, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export default function RestaurantOrderForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)

  const [header, setHeader] = useState({
    status: 'open',
    tableNumber: '',
    customerName: '',
    customerPhone: '',
    paymentMethod: 'cash',
    notes: '',
  })

  const createInvoiceMutation = useMutation({
    mutationFn: () => api.post(`/restaurant/orders/${id}/create-invoice`).then((res) => res.data),
    onSuccess: (data) => {
      const invoiceId = data?.invoice?._id
      if (invoiceId) {
        toast.success(language === 'ar' ? 'تم إنشاء الفاتورة' : 'Invoice created')
        queryClient.invalidateQueries(['restaurant-order', id])
        queryClient.invalidateQueries(['restaurant-orders'])
        queryClient.invalidateQueries(['invoices'])
        navigate(`/app/dashboard/accounting/invoices/${invoiceId}`)
      } else {
        toast.error(language === 'ar' ? 'لم يتم إنشاء الفاتورة' : 'Invoice not created')
      }
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const [lineItems, setLineItems] = useState([])

  const { data: menuItems } = useQuery({
    queryKey: ['restaurant-menu-items-lookup'],
    queryFn: () => api.get('/restaurant/menu-items', { params: { page: 1, limit: 200 } }).then((res) => res.data.items || []),
  })

  const menuOptions = useMemo(() => (Array.isArray(menuItems) ? menuItems : []), [menuItems])

  const totals = useMemo(() => {
    const normalized = lineItems.map((li) => {
      const quantity = toNumber(li.quantity, 0)
      const unitPrice = toNumber(li.unitPrice, 0)
      const taxRate = toNumber(li.taxRate ?? 15, 15)
      const lineSubtotal = quantity * unitPrice
      const lineTax = lineSubtotal * (taxRate / 100)
      const lineTotal = lineSubtotal + lineTax
      return { ...li, quantity, unitPrice, taxRate, lineSubtotal, lineTax, lineTotal }
    })

    const subtotal = normalized.reduce((sum, li) => sum + (li.lineSubtotal || 0), 0)
    const totalTax = normalized.reduce((sum, li) => sum + (li.lineTax || 0), 0)
    const grandTotal = subtotal + totalTax

    return { normalized, subtotal, totalTax, grandTotal }
  }, [lineItems])

  const { isLoading } = useQuery({
    queryKey: ['restaurant-order', id],
    queryFn: () => api.get(`/restaurant/orders/${id}`).then((res) => res.data),
    enabled: isEdit,
    onSuccess: (data) => {
      setHeader({
        status: data?.status || 'open',
        tableNumber: data?.tableNumber || '',
        customerName: data?.customerName || '',
        customerPhone: data?.customerPhone || '',
        paymentMethod: data?.paymentMethod || 'cash',
        notes: data?.notes || '',
      })
      setLineItems(
        (Array.isArray(data?.lineItems) ? data.lineItems : []).map((li) => ({
          menuItemId: li?.menuItemId?._id || li?.menuItemId || '',
          name: li?.name || '',
          nameAr: li?.nameAr || '',
          quantity: li?.quantity ?? 1,
          unitPrice: li?.unitPrice ?? 0,
          taxRate: li?.taxRate ?? 15,
        }))
      )
    },
  })

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...header,
        lineItems: totals.normalized
          .filter((li) => li?.quantity > 0 && (li?.menuItemId || li?.name))
          .map((li) => ({
            menuItemId: li.menuItemId || undefined,
            name: li.name || undefined,
            nameAr: li.nameAr || undefined,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            taxRate: li.taxRate,
          })),
      }

      return isEdit ? api.put(`/restaurant/orders/${id}`, payload) : api.post('/restaurant/orders', payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? (language === 'ar' ? 'تم تحديث الطلب' : 'Order updated') : language === 'ar' ? 'تم إنشاء الطلب' : 'Order created')
      queryClient.invalidateQueries(['restaurant-orders'])
      queryClient.invalidateQueries(['dashboard-restaurant-stats'])
      navigate('/app/dashboard/restaurant/orders')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const addLine = () => {
    setLineItems((prev) =>
      prev.concat({
        menuItemId: '',
        name: '',
        nameAr: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: 15,
      })
    )
  }

  const setLineValue = (idx, patch) => {
    setLineItems((prev) => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)))
  }

  const removeLine = (idx) => setLineItems((prev) => prev.filter((_, i) => i !== idx))

  const onMenuSelect = (idx, menuItemId) => {
    const m = menuOptions.find((x) => String(x._id) === String(menuItemId))
    if (!m) {
      setLineValue(idx, { menuItemId })
      return
    }

    setLineValue(idx, {
      menuItemId: m._id,
      name: m.nameEn || '',
      nameAr: m.nameAr || '',
      unitPrice: m.sellingPrice ?? 0,
      taxRate: m.taxRate ?? 15,
    })
  }

  useEffect(() => {
    if (lineItems.length === 0) addLine()
  }, [])

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEdit ? (language === 'ar' ? 'تعديل طلب' : 'Edit Order') : language === 'ar' ? 'طلب جديد' : 'New Order'}
          </h1>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate()
        }}
        className="space-y-6"
      >
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Receipt className="w-5 h-5 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'تفاصيل الطلب' : 'Order Details'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'الحالة' : 'Status'}</label>
              <select value={header.status} onChange={(e) => setHeader((p) => ({ ...p, status: e.target.value }))} className="select">
                <option value="open">{language === 'ar' ? 'مفتوح' : 'Open'}</option>
                <option value="paid">{language === 'ar' ? 'مدفوع' : 'Paid'}</option>
                <option value="cancelled">{language === 'ar' ? 'ملغي' : 'Cancelled'}</option>
              </select>
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'طريقة الدفع' : 'Payment'}</label>
              <select
                value={header.paymentMethod}
                onChange={(e) => setHeader((p) => ({ ...p, paymentMethod: e.target.value }))}
                className="select"
              >
                <option value="cash">{language === 'ar' ? 'نقداً' : 'Cash'}</option>
                <option value="card">{language === 'ar' ? 'بطاقة' : 'Card'}</option>
                <option value="transfer">{language === 'ar' ? 'تحويل' : 'Transfer'}</option>
                <option value="other">{language === 'ar' ? 'أخرى' : 'Other'}</option>
              </select>
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'رقم الطاولة' : 'Table'}</label>
              <input value={header.tableNumber} onChange={(e) => setHeader((p) => ({ ...p, tableNumber: e.target.value }))} className="input" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'اسم العميل' : 'Customer'}</label>
              <input value={header.customerName} onChange={(e) => setHeader((p) => ({ ...p, customerName: e.target.value }))} className="input" />
            </div>

            <div>
              <label className="label">{language === 'ar' ? 'رقم الجوال' : 'Phone'}</label>
              <input value={header.customerPhone} onChange={(e) => setHeader((p) => ({ ...p, customerPhone: e.target.value }))} className="input" />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="label">{language === 'ar' ? 'ملاحظات' : 'Notes'}</label>
              <textarea value={header.notes} onChange={(e) => setHeader((p) => ({ ...p, notes: e.target.value }))} className="input" rows={3} />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'الأصناف' : 'Items'}</h3>
            <button type="button" className="btn btn-secondary" onClick={addLine}>
              <Plus className="w-4 h-4" />
              {language === 'ar' ? 'إضافة' : 'Add'}
            </button>
          </div>

          <div className="space-y-3">
            {lineItems.map((li, idx) => (
              <div key={idx} className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-5">
                    <label className="label">{language === 'ar' ? 'الصنف' : 'Menu item'}</label>
                    <select
                      className="select"
                      value={li.menuItemId}
                      onChange={(e) => onMenuSelect(idx, e.target.value)}
                    >
                      <option value="">{language === 'ar' ? 'اختر صنف' : 'Select item'}</option>
                      {menuOptions.map((m) => (
                        <option key={m._id} value={m._id}>
                          {(language === 'ar' ? m.nameAr || m.nameEn : m.nameEn) || m.sku}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="label">{language === 'ar' ? 'الكمية' : 'Qty'}</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="input"
                      value={li.quantity}
                      onChange={(e) => setLineValue(idx, { quantity: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="label">{language === 'ar' ? 'السعر' : 'Price'}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input"
                      value={li.unitPrice}
                      onChange={(e) => setLineValue(idx, { unitPrice: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="label">{language === 'ar' ? 'الضريبة %' : 'Tax %'}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input"
                      value={li.taxRate}
                      onChange={(e) => setLineValue(idx, { taxRate: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-1 flex justify-end">
                    <button type="button" className="btn btn-danger" onClick={() => removeLine(idx)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-6 text-sm">
                  <div className="text-gray-500">{language === 'ar' ? 'الإجمالي' : 'Total'}</div>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    <Money value={toNumber(li.quantity, 0) * toNumber(li.unitPrice, 0) * (1 + toNumber(li.taxRate ?? 15, 15) / 100)} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-gray-100 dark:border-dark-700 pt-4 flex justify-end">
            <div className="w-full sm:w-80 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{language === 'ar' ? 'المجموع' : 'Subtotal'}</span>
                <span className="font-semibold"><Money value={totals.subtotal} /></span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{language === 'ar' ? 'الضريبة' : 'Tax'}</span>
                <span className="font-semibold"><Money value={totals.totalTax} /></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300 font-medium">{language === 'ar' ? 'الإجمالي' : 'Total'}</span>
                <span className="font-bold text-lg"><Money value={totals.grandTotal} /></span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="flex justify-end gap-3">
          {isEdit && (
            <button
              type="button"
              onClick={() => createInvoiceMutation.mutate()}
              disabled={createInvoiceMutation.isPending}
              className="btn btn-secondary"
            >
              {createInvoiceMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {language === 'ar' ? 'إنشاء فاتورة' : 'Create Invoice'}
            </button>
          )}
          <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
            {t('cancel')}
          </button>
          <button type="submit" disabled={mutation.isPending} className="btn btn-primary">
            {mutation.isPending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                {t('save')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
