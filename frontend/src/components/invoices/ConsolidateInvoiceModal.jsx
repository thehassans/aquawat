import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, FileText, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'

export default function ConsolidateInvoiceModal({ isOpen, onClose, customerId }) {
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  
  const [selectedIds, setSelectedIds] = useState([])

  // Fetch pending delivery notes for this customer
  const { data: deliveryNotes, isLoading } = useQuery({
    queryKey: ['delivery-notes-pending', customerId],
    queryFn: () => api.get('/delivery-notes', { params: { customerId, status: 'pending_invoice', limit: 100 } }).then(res => res.data.deliveryNotes),
    enabled: isOpen && !!customerId,
  })

  useEffect(() => {
    if (!isOpen) {
      setSelectedIds([])
    }
  }, [isOpen])

  const toggleSelection = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const consolidateMutation = useMutation({
    mutationFn: (deliveryNoteIds) => api.post('/invoices/consolidated', {
      customerId,
      dnIds: deliveryNoteIds,
      deliveryNoteIds,
    }),
    onSuccess: (res) => {
      toast.success(language === 'ar' ? 'تم تجميع الفاتورة بنجاح' : 'Consolidated Invoice generated successfully')
      queryClient.invalidateQueries(['invoices'])
      queryClient.invalidateQueries(['delivery-notes'])
      onClose()
      // You could navigate to the newly created invoice here
      // window.location.href = `/app/dashboard/invoices/${res.data._id}`
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error creating consolidated invoice')
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (selectedIds.length === 0) {
      toast.error(language === 'ar' ? 'يرجى تحديد سند تسليم واحد على الأقل' : 'Please select at least one delivery note')
      return
    }
    consolidateMutation.mutate(selectedIds)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <FileText className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{language === 'ar' ? 'فاتورة مجمعة' : 'Consolidated Invoice'}</h2>
                <p className="text-sm text-gray-500">{language === 'ar' ? 'حدد السندات المراد فوترتها' : 'Select delivery notes to invoice'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : deliveryNotes?.length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                {language === 'ar' ? 'لا يوجد سندات تسليم معلقة لهذا العميل' : 'No pending delivery notes for this customer'}
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-12">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                          checked={selectedIds.length === deliveryNotes?.length && deliveryNotes?.length > 0}
                          onChange={(e) => setSelectedIds(e.target.checked ? deliveryNotes.map(dn => dn._id) : [])}
                        />
                      </th>
                      <th>{language === 'ar' ? 'رقم السند' : 'DN Number'}</th>
                      <th>{language === 'ar' ? 'الطلب' : 'Order'}</th>
                      <th>{language === 'ar' ? 'البنود' : 'Items'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryNotes?.map((dn) => (
                      <tr key={dn._id} className={selectedIds.includes(dn._id) ? 'bg-primary-50 dark:bg-primary-900/10' : ''}>
                        <td>
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                            checked={selectedIds.includes(dn._id)}
                            onChange={() => toggleSelection(dn._id)}
                          />
                        </td>
                        <td className="font-medium text-gray-900 dark:text-white">{dn.dnNumber}</td>
                        <td>{dn.purchaseOrderId?.poNumber || '-'}</td>
                        <td>{dn.lineItems?.length || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-900/50 flex justify-end gap-3">
            <button onClick={onClose} className="btn btn-secondary">
              {t('cancel')}
            </button>
            <button 
              onClick={handleSubmit} 
              disabled={selectedIds.length === 0 || consolidateMutation.isPending} 
              className="btn btn-primary"
            >
              {consolidateMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {language === 'ar' ? 'توليد الفاتورة' : 'Generate Invoice'}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
