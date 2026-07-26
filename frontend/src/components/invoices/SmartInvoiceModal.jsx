import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Image as ImageIcon, Sparkles, ScanLine, FileText, CheckCircle2 } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

export default function SmartInvoiceModal({ isOpen, onClose, language, onSuccess }) {
  const [file, setFile] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)

  const isArabic = language === 'ar'

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (selected) {
      if (selected.type.startsWith('image/') || selected.type === 'application/pdf') {
        setFile(selected)
        processMedia(selected)
      } else {
        toast.error(isArabic ? 'صيغة الملف غير مدعومة. يرجى رفع صورة أو PDF.' : 'Unsupported format. Upload image or PDF.')
      }
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragActive(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      if (droppedFile.type.startsWith('image/') || droppedFile.type === 'application/pdf') {
        setFile(droppedFile)
        processMedia(droppedFile)
      } else {
        toast.error(isArabic ? 'صيغة الملف غير مدعومة.' : 'Unsupported format.')
      }
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragActive(true)
  }

  const handleDragLeave = () => {
    setIsDragActive(false)
  }

  const processMedia = async (mediaFile) => {
    setIsProcessing(true)
    const formData = new FormData()
    formData.append('media', mediaFile)

    try {
      const res = await api.post('/ai/extract-smart-invoice', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const extractedData = res.data.extractedData
      
      toast.success(isArabic ? 'تم استخراج البيانات بنجاح!' : 'Data extracted successfully!')
      onClose()
      
      if (onSuccess) {
        onSuccess(extractedData)
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isArabic ? 'فشل تحليل البيانات' : 'Failed to analyze data'))
    } finally {
      setIsProcessing(false)
      setFile(null)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl"
          onClick={(e) => { if (e.target === e.currentTarget && !isProcessing) onClose() }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg rounded-[2.5rem] bg-white/10 dark:bg-dark-900/60 shadow-[0_0_60px_-15px_rgba(79,70,229,0.5)] border border-white/20 overflow-hidden backdrop-blur-3xl"
          >
            {/* Background Glows */}
            <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-indigo-500/20 to-transparent pointer-events-none" />
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-500/30 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-violet-500/20 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative flex items-center justify-between p-8 pb-4">
              <div className="flex items-center gap-4">
                <div className="relative p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
                  <ScanLine className="w-6 h-6 text-white" />
                  <div className="absolute inset-0 bg-white/20 rounded-2xl animate-pulse" />
                </div>
                <div>
                  <h3 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 dark:from-white dark:to-gray-400">
                    {isArabic ? 'قارئ الفواتير الذكي' : 'Smart Invoice OCR'}
                  </h3>
                  <p className="text-sm text-indigo-100/70 font-medium mt-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                    {isArabic ? 'قراءة آلية دقيقة (Gemini AI)' : 'High precision extraction via Gemini'}
                  </p>
                </div>
              </div>
              {!isProcessing && (
                <button 
                  onClick={onClose} 
                  className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition-all active:scale-95 border border-white/5"
                >
                  <X className="w-5 h-5 text-white/80" />
                </button>
              )}
            </div>

            <div className="relative p-8 pt-4 flex flex-col items-center">
              {isProcessing ? (
                <div className="w-full py-16 flex flex-col items-center justify-center">
                  <div className="relative">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="absolute -inset-4 rounded-full border-2 border-dashed border-indigo-400/30"
                    />
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="absolute -inset-2 rounded-full border-2 border-dashed border-violet-400/30"
                    />
                    <div className="relative p-6 rounded-3xl bg-indigo-500/10 backdrop-blur-sm border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                      <ScanLine className="w-10 h-10 text-indigo-300 animate-pulse" />
                      <motion.div 
                        initial={{ top: 0 }}
                        animate={{ top: "100%" }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_10px_rgba(129,140,248,0.8)] z-10"
                      />
                    </div>
                  </div>
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-indigo-100 font-medium text-lg mt-10 tracking-wide"
                  >
                    {isArabic ? 'جاري تحليل تفاصيل الفاتورة...' : 'Analyzing invoice details...'}
                  </motion.p>
                  <p className="text-sm text-indigo-200/50 mt-2 font-mono">
                    {isArabic ? 'استخراج العناصر، الضرائب، والموردين' : 'Extracting items, taxes, & suppliers'}
                  </p>
                </div>
              ) : (
                <div className="w-full">
                  <input
                    type="file"
                    id="smart-ocr-upload"
                    accept="image/*, application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <label 
                    htmlFor="smart-ocr-upload" 
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`
                      w-full cursor-pointer flex flex-col items-center justify-center p-12 
                      rounded-[2rem] border-2 border-dashed transition-all duration-300
                      ${isDragActive 
                        ? 'border-indigo-400 bg-indigo-500/20 scale-[1.02] shadow-[0_0_40px_-10px_rgba(99,102,241,0.3)]' 
                        : 'border-white/10 bg-black/20 hover:bg-white/5 hover:border-indigo-400/50'}
                    `}
                  >
                    <div className="p-5 rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 shadow-xl mb-6 group-hover:scale-110 transition-transform">
                      <ImageIcon className="w-8 h-8 text-indigo-200" />
                    </div>
                    <span className="text-xl font-bold text-white mb-2 text-center">
                      {isArabic ? 'اسحب أو اضغط لرفع الفاتورة' : 'Drop or Click to Upload Invoice'}
                    </span>
                    <span className="text-sm font-medium text-indigo-200/60 text-center px-4">
                      {isArabic 
                        ? 'يدعم الصور و PDF (سيتم قراءة الأصناف باللغتين العربية والإنجليزية)' 
                        : 'Supports Images & PDFs (Will read items in Arabic & English)'}
                    </span>
                  </label>
                  
                  <div className="grid grid-cols-3 gap-3 mt-6">
                    <div className="flex flex-col items-center p-4 rounded-2xl bg-white/5 border border-white/5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-2" />
                      <span className="text-xs text-white/70 font-medium text-center">{isArabic ? 'تعبئة الأصناف' : 'Extracts Items'}</span>
                    </div>
                    <div className="flex flex-col items-center p-4 rounded-2xl bg-white/5 border border-white/5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-2" />
                      <span className="text-xs text-white/70 font-medium text-center">{isArabic ? 'حساب الضرائب' : 'Calculates VAT'}</span>
                    </div>
                    <div className="flex flex-col items-center p-4 rounded-2xl bg-white/5 border border-white/5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-2" />
                      <span className="text-xs text-white/70 font-medium text-center">{isArabic ? 'ترجمة ثنائية' : 'Bilingual AI'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
