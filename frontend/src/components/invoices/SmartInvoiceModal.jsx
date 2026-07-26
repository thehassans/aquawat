import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mic, Image as ImageIcon, Sparkles, Loader2 } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

export default function SmartInvoiceModal({ isOpen, onClose, language }) {
  const [file, setFile] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const navigate = useNavigate()

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const audioFile = new File([audioBlob], 'voice_prompt.webm', { type: 'audio/webm' })
        processMedia(audioFile)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error(err)
      toast.error(isArabic ? 'لم نتمكن من الوصول للميكروفون.' : 'Could not access microphone.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
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
      
      // Navigate to create page with pre-filled data via state
      navigate('/app/dashboard/invoices/new', { state: { prefillData: extractedData } })
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          onClick={(e) => { if (e.target === e.currentTarget && !isProcessing && !isRecording) onClose() }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="relative w-full max-w-md rounded-[2rem] bg-gradient-to-b from-indigo-900 to-slate-900 shadow-2xl overflow-hidden border border-white/10"
          >
            <div className="flex items-center justify-between p-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-500/20 shadow-inner">
                  <Sparkles className="w-6 h-6 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    {isArabic ? 'إنشاء فاتورة ذكي' : 'Smart Invoice'}
                  </h3>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    {isArabic ? 'مدعوم بالذكاء الاصطناعي (Gemini & Whisper)' : 'Powered by AI (Gemini & Whisper)'}
                  </p>
                </div>
              </div>
              {(!isProcessing && !isRecording) && (
                <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5 text-white/70" />
                </button>
              )}
            </div>

            <div className="p-8 pt-2 flex flex-col items-center gap-8">
              {isProcessing ? (
                <div className="py-12 flex flex-col items-center">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full border-[3px] border-indigo-500/20" />
                    <div className="absolute inset-0 rounded-full border-[3px] border-indigo-400 border-t-transparent animate-spin" />
                    <Sparkles className="h-8 w-8 text-indigo-300 m-6 animate-pulse" />
                  </div>
                  <p className="text-indigo-200 mt-6 font-medium animate-pulse">
                    {isArabic ? 'جاري تحليل الفاتورة الذكي...' : 'Analyzing with AI...'}
                  </p>
                </div>
              ) : (
                <>
                  <button 
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={`relative flex items-center justify-center w-32 h-32 rounded-full transition-all duration-300 ${isRecording ? 'bg-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.5)] scale-110' : 'bg-indigo-600 shadow-[0_10px_30px_rgba(79,70,229,0.4)] hover:bg-indigo-500 hover:scale-105'}`}
                  >
                    {isRecording && (
                      <span className="absolute inset-0 rounded-full border-2 border-rose-400 animate-ping opacity-75" />
                    )}
                    <Mic className={`w-12 h-12 ${isRecording ? 'text-white' : 'text-indigo-100'}`} />
                  </button>
                  
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white">
                      {isRecording ? (isArabic ? 'جاري التسجيل... ارفع إصبعك للإرسال' : 'Recording... Release to send') : (isArabic ? 'اضغط مطولاً للتحدث' : 'Hold to speak')}
                    </p>
                    <p className="text-xs text-indigo-300/70 mt-1 max-w-[250px]">
                      {isArabic ? '"أنشئ فاتورة لمحمد بقيمة 500 ريال مقابل لابتوب"' : '"Create an invoice for Mohammed for 500 SAR for a laptop"'}
                    </p>
                  </div>

                  <div className="w-full flex items-center gap-4 py-2">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs font-bold uppercase tracking-widest text-white/30">{isArabic ? 'أو' : 'OR'}</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  <input
                    type="file"
                    id="smart-ocr-upload"
                    accept="image/*, application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <label 
                    htmlFor="smart-ocr-upload" 
                    className="w-full cursor-pointer flex items-center justify-center gap-3 py-4 rounded-xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <ImageIcon className="w-5 h-5 text-indigo-300" />
                    <span className="text-sm font-semibold text-white">
                      {isArabic ? 'رفع صورة فاتورة (OCR)' : 'Upload Invoice Image (OCR)'}
                    </span>
                  </label>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
