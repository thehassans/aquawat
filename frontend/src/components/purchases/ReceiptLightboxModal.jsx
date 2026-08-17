import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, ExternalLink, FileText, Image as ImageIcon } from 'lucide-react'

export default function ReceiptLightboxModal({ isOpen, onClose, url, title, isAr }) {
  if (!isOpen || !url) return null

  const isPdf = String(url).toLowerCase().endsWith('.pdf')

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative flex flex-col max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#111827] border border-gray-100 dark:border-white/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
                {isPdf ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
              </span>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {title || (isAr ? 'إيصال / مستند التحويل' : 'Transaction Receipt / Screenshot')}
                </h3>
                <p className="text-[11px] text-gray-400">
                  {isAr ? 'مستند إثبات السداد المرفق' : 'Attached payment verification document'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
                title={isAr ? 'فتح في نافذة جديدة' : 'Open in new tab'}
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={url}
                download
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
                title={isAr ? 'تحميل المستند' : 'Download file'}
              >
                <Download className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-50 dark:bg-[#0c111a] min-h-[300px]">
            {isPdf ? (
              <iframe src={url} title="Document Preview" className="h-[60vh] w-full rounded-2xl border-0" />
            ) : (
              <img
                src={url}
                alt="Payment Receipt"
                className="max-h-[65vh] w-auto max-w-full rounded-2xl object-contain shadow-md"
              />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
