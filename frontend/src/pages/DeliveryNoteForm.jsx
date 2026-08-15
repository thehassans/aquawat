import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, FileText, CheckCircle2, ShoppingCart } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'

function DeliveryNoteOrderPicker({ language, navigate }) {
  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders-for-dn'],
    queryFn: () => api.get('/purchase-orders', { params: { limit: 50 } }).then((res) => res.data),
  })
  const orders = (data?.purchaseOrders || []).filter((po) => ['approved', 'sent', 'partially_received'].includes(String(po.status || '')))

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {language === 'ar' ? 'سند تسليم جديد' : 'New Delivery Note'}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {language === 'ar'
            ? 'سند التسليم يُنشأ من طلب بيع أو شراء معتمد — اختر الطلب أدناه.'
            : 'A delivery note is created from an approved sales / purchase order. Choose an order below to continue.'}
        </p>
      </div>
      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-white/10 dark:bg-dark-800">
          <p className="text-slate-600 dark:text-slate-300">
            {language === 'ar' ? 'لا توجد طلبات معتمدة لإنشاء سند تسليم.' : 'No approved orders are ready for a delivery note.'}
          </p>
          <button type="button" className="btn btn-primary mt-4" onClick={() => navigate('/app/dashboard/purchases/orders')}>
            <ShoppingCart className="h-4 w-4" />
            {language === 'ar' ? 'فتح طلبات الشراء' : 'Open Purchase Orders'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((po) => (
            <button
              key={po._id}
              type="button"
              onClick={() => navigate(`/app/dashboard/delivery-notes/new?poId=${po._id}`)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-start transition hover:border-emerald-400 dark:border-white/10 dark:bg-dark-800"
            >
              <span>
                <span className="block font-semibold text-slate-900 dark:text-white">{po.poNumber}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{po.supplierId?.nameEn || po.supplierId?.nameAr || po.status}</span>
              </span>
              <span className="text-xs font-semibold uppercase text-emerald-600">{po.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DeliveryNoteForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [searchParams] = useSearchParams()
  const poId = searchParams.get('poId')
  
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)

  const [quantities, setQuantities] = useState({})

  // Fetch Delivery Note if editing
  const { data: dn, isLoading: dnLoading } = useQuery({
    queryKey: ['delivery-note', id],
    queryFn: () => api.get(`/delivery-notes/${id}`).then((res) => res.data),
    enabled: isEdit,
  })

  // Fetch PO if creating from PO
  const { data: po, isLoading: poLoading } = useQuery({
    queryKey: ['purchase-order', poId],
    queryFn: () => api.get(`/purchase-orders/${poId}`).then((res) => res.data),
    enabled: !isEdit && !!poId,
    onSuccess: (data) => {
      // Pre-fill maximum available quantities
      const initialQtys = {}
      data?.lineItems?.forEach((li) => {
        const itemObjId = li._id || li.productId?._id || li.productId
        const remaining = Math.max(0, Number(li.quantityOrdered || 0) - Number(li.quantityDelivered || 0))
        initialQtys[itemObjId] = remaining
      })
      setQuantities(initialQtys)
    }
  })

  const saveMutation = useMutation({
    mutationFn: (data) => api.post('/delivery-notes', data),
    onSuccess: (res) => {
      toast.success(language === 'ar' ? 'تم إنشاء إذن التسليم' : 'Delivery Note created successfully')
      queryClient.invalidateQueries(['delivery-notes'])
      queryClient.invalidateQueries(['purchase-orders'])
      if (res.data?.offline) {
        navigate('/app/dashboard/delivery-notes')
      } else {
        navigate(`/app/dashboard/delivery-notes/${res.data?._id}`)
      }
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error creating delivery note'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!poId) return

    const lineItems = (po?.lineItems || []).map(li => {
      const itemObjId = li._id || li.productId?._id || li.productId
      const qty = Number(quantities[itemObjId] || 0)
      if (qty <= 0) return null
      return {
        productId: li.productId?._id || li.productId,
        sourcePoItemId: li._id,
        description: li.description,
        quantityDelivered: qty
      }
    }).filter(Boolean)

    if (lineItems.length === 0) {
      toast.error(language === 'ar' ? 'يجب تسليم بند واحد على الأقل' : 'At least one item must be delivered')
      return
    }

    saveMutation.mutate({
      purchaseOrderId: poId,
      customerId: po?.customerId?._id || po?.supplierId, // Adapting to standard fields
      lineItems
    })
  }

  if ((isEdit && dnLoading) || (!isEdit && poLoading)) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isEdit) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {language === 'ar' ? 'إذن التسليم' : 'Delivery Note'} #{dn?.dnNumber}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {language === 'ar' ? 'الحالة:' : 'Status:'} <span className="badge badge-neutral">{dn?.status}</span>
            </p>
          </div>
        </div>
        
        <div className="card p-6">
          <div className="table-container mt-4">
            <table className="table">
              <thead>
                <tr>
                  <th>{language === 'ar' ? 'المنتج' : 'Product'}</th>
                  <th>{language === 'ar' ? 'الوصف' : 'Description'}</th>
                  <th>{language === 'ar' ? 'الكمية المسلّمة' : 'Delivered Qty'}</th>
                  <th>{language === 'ar' ? 'الكمية المفوترة' : 'Invoiced Qty'}</th>
                </tr>
              </thead>
              <tbody>
                {dn?.lineItems?.map((li, i) => (
                  <tr key={i}>
                    <td>{language === 'ar' ? li.productId?.nameAr || li.productId?.nameEn : li.productId?.nameEn || li.productId?.nameAr}</td>
                    <td>{li.description || '-'}</td>
                    <td>{li.quantityDelivered}</td>
                    <td>{li.quantityInvoiced}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  if (!poId && !isEdit) {
    return <DeliveryNoteOrderPicker language={language} navigate={navigate} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'إنشاء إذن تسليم' : 'Create Delivery Note'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {language === 'ar' ? 'من الطلب:' : 'From Order:'} {po?.poNumber}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'بنود التسليم' : 'Delivery Items'}</h3>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{language === 'ar' ? 'المنتج' : 'Product'}</th>
                  <th>{language === 'ar' ? 'مطلوب' : 'Ordered'}</th>
                  <th>{language === 'ar' ? 'متبقي' : 'Remaining'}</th>
                  <th className="w-48">{language === 'ar' ? 'كمية التسليم' : 'Deliver Qty'}</th>
                </tr>
              </thead>
              <tbody>
                {(po?.lineItems || []).map((li) => {
                  const itemObjId = li._id || li.productId?._id || li.productId
                  const name = language === 'ar' ? li.productId?.nameAr || li.productId?.nameEn : li.productId?.nameEn || li.productId?.nameAr
                  const ordered = Number(li.quantityOrdered || 0)
                  const delivered = Number(li.quantityDelivered || 0)
                  const remaining = Math.max(0, ordered - delivered)

                  return (
                    <tr key={itemObjId}>
                      <td className="font-medium text-gray-900 dark:text-white">{name || '-'}</td>
                      <td>{ordered}</td>
                      <td>{remaining}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          max={remaining}
                          value={quantities[itemObjId] ?? ''}
                          onChange={(e) => setQuantities(prev => ({ ...prev, [itemObjId]: e.target.value }))}
                          className="input"
                          disabled={remaining <= 0}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
              {t('cancel')}
            </button>
            <button type="submit" disabled={saveMutation.isPending} className="btn btn-primary">
              {saveMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {language === 'ar' ? 'إنشاء' : 'Create'}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </form>
    </div>
  )
}
