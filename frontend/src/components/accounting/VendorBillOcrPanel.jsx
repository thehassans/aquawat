import { useCallback, useEffect, useState } from 'react'
import { FileUp, Loader2, ScanLine, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'

/**
 * Side-by-side vendor bill OCR: upload PDF/image, preview document, pre-fill bill fields.
 */
export default function VendorBillOcrPanel({
  language = 'en',
  onApply,
  onClose,
}) {
  const isAr = language === 'ar'
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const runOcr = useCallback(async () => {
    if (!file) {
      toast.error(isAr ? 'اختر ملفاً أولاً' : 'Choose a file first')
      return
    }
    setExtracting(true)
    try {
      const form = new FormData()
      form.append('media', file)
      const { data } = await api.post('/ai/extract-smart-invoice', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setExtracted(data?.extractedData || data)
      toast.success(isAr ? 'تم استخراج بيانات الفاتورة' : 'Bill data extracted')
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل OCR' : 'OCR failed'))
    } finally {
      setExtracting(false)
    }
  }, [file, isAr])

  const handleApply = () => {
    if (!extracted) return
    onApply?.(extracted, file)
  }

  return (
    <div className="rounded-2xl border border-sky-200/80 bg-sky-50/40 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-sky-600" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {isAr ? 'رقمنة فاتورة المورد (OCR)' : 'Vendor bill digitization (OCR)'}
          </p>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/80">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-sky-300 bg-white/70 px-4 py-8 text-center dark:border-sky-800 dark:bg-dark-800/60">
            <FileUp className="h-8 w-8 text-sky-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {file ? file.name : (isAr ? 'PDF أو صورة فاتورة المورد' : 'Supplier bill PDF or image')}
            </span>
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null)
                setExtracted(null)
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" disabled={!file || extracting} onClick={runOcr}>
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              {isAr ? 'استخراج' : 'Extract fields'}
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={!extracted} onClick={handleApply}>
              {isAr ? 'تطبيق على المسودة' : 'Apply to draft'}
            </button>
          </div>
          {extracted ? (
            <div className="rounded-xl border border-slate-200/80 bg-white p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300">
              <p><strong>{isAr ? 'المورد' : 'Vendor'}:</strong> {extracted?.supplier?.name || extracted?.supplier?.nameAr || '—'}</p>
              <p><strong>{isAr ? 'التاريخ' : 'Date'}:</strong> {extracted?.issueDate || '—'}</p>
              <p><strong>{isAr ? 'الإجمالي' : 'Total'}:</strong> {extracted?.grandTotal ?? extracted?.totalAmount ?? '—'}</p>
              <p><strong>{isAr ? 'الضريبة' : 'VAT'}:</strong> {extracted?.totalTax ?? '—'}</p>
              <p><strong>{isAr ? 'البنود' : 'Lines'}:</strong> {Array.isArray(extracted?.lineItems) ? extracted.lineItems.length : 0}</p>
            </div>
          ) : null}
        </div>

        <div className="min-h-[280px] overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-dark-900">
          {previewUrl ? (
            file?.type === 'application/pdf' ? (
              <iframe title="Bill PDF" src={previewUrl} className="h-[360px] w-full" />
            ) : (
              <img src={previewUrl} alt="" className="max-h-[360px] w-full object-contain" />
            )
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
              {isAr ? 'معاينة المستند' : 'Document preview'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
