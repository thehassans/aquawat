import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle, FileText } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import PartnerCombobox from '../inventory/PartnerCombobox'

export default function BulkInvoiceModal({ isOpen, onClose, language, t, mode = 'bulk', onPopulate }) {
  const [file, setFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState(null)
  const queryClient = useQueryClient()

  const [flow, setFlow] = useState('sell')
  const [supplierId, setSupplierId] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState(null)

  const isArabic = language === 'ar'

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (selected) {
      if (selected.name.match(/\.(csv|xlsx|xls)$/i)) {
        setFile(selected)
        setResult(null)
      } else {
        toast.error(isArabic ? 'صيغة الملف غير مدعومة. يرجى رفع ملف CSV أو Excel.' : 'Unsupported file format. Please upload CSV or Excel.')
      }
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setIsUploading(true)

    if (mode === 'populate' && onPopulate) {
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const records = XLSX.utils.sheet_to_json(sheet);
            
            const lineItems = [];
            let party = null;
            
            for (const record of records) {
              const qty = Number(record['Quantity']) || 1;
              const unitPrice = Number(record['Unit Price']) || 0;
              const taxRate = Number(record['Tax Rate'] || 15);
              
              if (unitPrice > 0 || record['Item Name']) {
                lineItems.push({
                  productName: record['Item Name'] || 'Item',
                  productNameAr: record['Item Name Arabic'] || '',
                  quantity: qty,
                  unitPrice: unitPrice,
                  taxRate: taxRate,
                  unitCode: record['UOM'] || record['Unit'] || 'PCE'
                });
              }
              
              if (!party) {
                const partyName = record['Vendor Name'] || record['Customer Name'] || record['Name'] || '';
                const partyNameAr = record['Vendor Name Arabic'] || record['Customer Name Arabic'] || record['Name Arabic'] || '';
                const partyVat = record['Vendor VAT'] || record['Customer VAT'] || record['VAT'] || '';
                if (partyName || partyVat) {
                  party = { name: partyName, nameAr: partyNameAr, vatNumber: partyVat };
                }
              }
            }
            
            onPopulate({ lineItems, party });
            toast.success(isArabic ? 'تم استيراد البيانات بنجاح' : 'Data imported successfully');
            onClose();
          } catch (err) {
            toast.error(isArabic ? 'فشل قراءة الملف' : 'Failed to parse file');
            console.error(err);
          } finally {
            setIsUploading(false);
          }
        };
        reader.onerror = () => {
          toast.error(isArabic ? 'فشل قراءة الملف' : 'Failed to parse file');
          setIsUploading(false);
        };
        reader.readAsArrayBuffer(file);
      } catch (err) {
        toast.error(isArabic ? 'فشل قراءة الملف' : 'Failed to parse file');
        setIsUploading(false);
      }
      return;
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('businessContext', 'trading') // default
    formData.append('flow', flow)
    if (flow === 'purchase' && supplierId) {
      formData.append('supplierId', supplierId)
    }

    try {
      const res = await api.post('/invoices/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResult({
        successCount: res.data.successCount,
        failCount: res.data.failCount,
      })
      toast.success(isArabic ? 'تمت عملية الرفع بنجاح' : 'Upload completed successfully')
      queryClient.invalidateQueries(['invoices'])
    } catch (err) {
      toast.error(err.response?.data?.error || (isArabic ? 'فشل رفع الملف' : 'Upload failed'))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-dark-800 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-900/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-100 dark:bg-primary-900/30">
                  <FileSpreadsheet className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    {mode === 'populate' 
                      ? (isArabic ? 'استيراد بيانات الفاتورة' : 'Import Invoice Data')
                      : (isArabic ? 'إضافة فواتير مجمعة' : 'Bulk Invoice Upload')}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isArabic ? 'ارفع ملف CSV أو Excel (XLSX)' : 'Upload CSV or Excel (XLSX) file'}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              {!result ? (
                <div className="space-y-6">
                  <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-dark-700 p-8 text-center bg-gray-50 dark:bg-dark-900/30">
                    <input
                      type="file"
                      id="bulk-upload-file"
                      accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <label htmlFor="bulk-upload-file" className="cursor-pointer flex flex-col items-center">
                      <div className="p-4 rounded-full bg-white dark:bg-dark-800 shadow-sm mb-4">
                        <UploadCloud className="w-8 h-8 text-primary-500" />
                      </div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {file ? file.name : (isArabic ? 'اضغط لاختيار ملف' : 'Click to select a file')}
                      </span>
                      <span className="text-xs text-gray-400 mt-2">
                        {isArabic ? 'الحد الأقصى للملف 10 ميجابايت' : 'Maximum file size is 10MB'}
                      </span>
                    </label>
                  </div>

                  {mode === 'bulk' && (
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      {isArabic ? 'نوع الفواتير' : 'Invoice Type'}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFlow('sell')}
                        className={`p-3 rounded-xl border text-center transition-colors ${
                          flow === 'sell'
                            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-dark-700 dark:text-gray-400 dark:hover:bg-dark-700/50'
                        }`}
                      >
                        {isArabic ? 'فواتير مبيعات' : 'Sales Invoices'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFlow('purchase')}
                        className={`p-3 rounded-xl border text-center transition-colors ${
                          flow === 'purchase'
                            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-dark-700 dark:text-gray-400 dark:hover:bg-dark-700/50'
                        }`}
                      >
                        {isArabic ? 'فواتير مشتريات' : 'Purchase Invoices'}
                      </button>
                    </div>
                  </div>
                  
                  {flow === 'purchase' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        {isArabic ? 'المورد (اختياري)' : 'Supplier (Optional)'}
                      </label>
                      <PartnerCombobox
                        role="vendor"
                        value={supplierId}
                        selectedOption={selectedSupplier}
                        ar={isArabic}
                        language={language}
                        onChange={(id, opt) => {
                          setSupplierId(id || '')
                          setSelectedSupplier(opt || null)
                        }}
                      />
                    </motion.div>
                  )}
                </div>
              )}

                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div className="text-xs text-amber-800 dark:text-amber-200/80 leading-relaxed space-y-2">
                      <p className="font-semibold">
                        {isArabic ? 'أعمدة القالب المطلوبة:' : 'Required Template Columns:'}
                      </p>
                      <ul className="list-disc list-inside opacity-90 space-y-1">
                        <li>Invoice Reference <em>({isArabic ? 'لتجميع الأصناف في فاتورة واحدة' : 'To group items into one invoice'})</em></li>
                        <li>Customer Name, Customer VAT, Issue Date</li>
                        <li>Item Name, Quantity, Unit Price, Tax Rate</li>
                      </ul>
                    </div>
                  </div>

                  <button
                    onClick={handleUpload}
                    disabled={!file || isUploading}
                    className="btn btn-primary w-full h-12 shadow-lg shadow-primary-500/25"
                  >
                    {isUploading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      isArabic ? 'بدء الرفع' : 'Start Upload'
                    )}
                  </button>
                </div>
              ) : (
                <div className="py-8 text-center space-y-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-2">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                      {isArabic ? 'اكتملت العملية' : 'Process Completed'}
                    </h4>
                    <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
                      {isArabic 
                        ? `تم إنشاء ${result.successCount} فاتورة بنجاح.` 
                        : `Successfully created ${result.successCount} invoices.`}
                    </p>
                    {result.failCount > 0 && (
                      <p className="text-sm text-rose-500 mt-1 font-medium">
                        {isArabic 
                          ? `فشل إنشاء ${result.failCount} صفوف.` 
                          : `Failed to create ${result.failCount} rows.`}
                      </p>
                    )}
                  </div>
                  <button onClick={onClose} className="btn btn-secondary w-full h-12">
                    {isArabic ? 'إغلاق' : 'Close'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
