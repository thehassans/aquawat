import React, { useState, useRef } from 'react'
import { Bold, Highlighter, List, Eye, Edit3, Sparkles } from 'lucide-react'
import { formatRichText } from '../../lib/formatRichText'

export default function RichTextNoteField({
  label,
  value = '',
  onChange,
  onRemove,
  placeholder,
  rows = 4,
  language = 'en',
  className = '',
  fieldControlClass = '',
}) {
  const isAr = language === 'ar'
  const [showPreview, setShowPreview] = useState(false)
  const textareaRef = useRef(null)

  const applyFormatting = (prefix, suffix, defaultText = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentVal = value || ''
    const selectedText = currentVal.substring(start, end) || defaultText

    const newVal =
      currentVal.substring(0, start) +
      prefix +
      selectedText +
      suffix +
      currentVal.substring(end)

    if (onChange) {
      onChange(newVal)
    }

    // Restore focus and selection
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selectedText.length
      )
    }, 0)
  }

  const handleBold = () => {
    applyFormatting('**', '**', isAr ? 'نص عريض' : 'Bold Text')
  }

  const handleHighlight = () => {
    applyFormatting('==', '==', isAr ? 'ملاحظة مميزة' : 'Highlighted Note')
  }

  const handleBullet = () => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentVal = value || ''
    const selectedText = currentVal.substring(start, end)

    if (selectedText.includes('\n')) {
      const bulleted = selectedText
        .split('\n')
        .map((l) => (l.trim().startsWith('•') ? l : `• ${l}`))
        .join('\n')
      const newVal =
        currentVal.substring(0, start) + bulleted + currentVal.substring(end)
      if (onChange) onChange(newVal)
    } else {
      const newVal =
        currentVal.substring(0, start) +
        (currentVal.length === 0 || currentVal.endsWith('\n') ? '• ' : '\n• ') +
        (selectedText || (isAr ? 'بند جديد' : 'Bullet item')) +
        currentVal.substring(end)
      if (onChange) onChange(newVal)
    }

    setTimeout(() => textarea.focus(), 0)
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {label && (
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
            {label}
          </label>
        )}

        {/* Rich Formatting Toolbar */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200/90 bg-slate-50/90 p-1 shadow-2xs dark:border-dark-600 dark:bg-dark-800">
          <button
            type="button"
            onClick={handleBold}
            title={isAr ? 'خط عريض (Bold)' : 'Bold text (**text**)'}
            className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-extrabold text-slate-700 hover:bg-white hover:text-slate-900 hover:shadow-2xs dark:text-slate-300 dark:hover:bg-dark-700 dark:hover:text-white"
          >
            <Bold className="h-3.5 w-3.5" />
            <span className="text-[11px] font-black">{isAr ? 'عريض' : 'Bold'}</span>
          </button>

          <button
            type="button"
            onClick={handleHighlight}
            title={isAr ? 'تمييز باللون الأصفر (Highlight)' : 'Highlight text (==text==)'}
            className="flex h-7 items-center gap-1 rounded-lg bg-amber-100/80 px-2 text-xs font-bold text-amber-900 hover:bg-amber-200 hover:shadow-2xs dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30"
          >
            <Highlighter className="h-3.5 w-3.5" />
            <span className="text-[11px]">{isAr ? 'تمييز' : 'Highlight'}</span>
          </button>

          <button
            type="button"
            onClick={handleBullet}
            title={isAr ? 'قائمة نقطية (Bullet)' : 'Bullet point (• item)'}
            className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-700 hover:bg-white hover:text-slate-900 hover:shadow-2xs dark:text-slate-300 dark:hover:bg-dark-700 dark:hover:text-white"
          >
            <List className="h-3.5 w-3.5" />
            <span className="text-[11px]">{isAr ? 'نقاط' : 'List'}</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-dark-600 mx-0.5" />

          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            title={showPreview ? (isAr ? 'العودة للتحرير' : 'Edit') : (isAr ? 'معاينة التنسيق' : 'Preview formatting')}
            className={`flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-bold transition-colors ${
              showPreview
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-dark-700'
            }`}
          >
            {showPreview ? <Edit3 className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span className="text-[11px]">{showPreview ? (isAr ? 'تحرير' : 'Edit') : (isAr ? 'معاينة' : 'Preview')}</span>
          </button>

          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="ms-1 text-[11px] font-bold text-slate-400 hover:text-red-600 px-1"
            >
              {isAr ? 'إزالة' : 'Remove'}
            </button>
          )}
        </div>
      </div>

      {/* Editor or Live Preview */}
      {showPreview ? (
        <div
          className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-800 shadow-2xs dark:border-dark-600 dark:bg-dark-900 dark:text-slate-200"
          dir={isAr ? 'rtl' : 'auto'}
        >
          {value ? (
            formatRichText(value)
          ) : (
            <span className="text-slate-400 italic">
              {isAr ? 'لا يوجد نص مكتوب للمعاينة...' : 'No text entered to preview...'}
            </span>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder || (isAr ? 'أدخل النص... يمكنك تحديد أي كلمة والضغط على "عريض" أو "تمييز"' : 'Enter text... select any word and click Bold or Highlight')}
          className={`w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-dark-600 dark:bg-dark-900 dark:text-white dark:focus:border-slate-500 ${fieldControlClass}`}
          dir={isAr ? 'rtl' : 'auto'}
        />
      )}

      {/* Helpful formatting shortcut tip */}
      <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-slate-400">
        <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
        <span>
          {isAr
            ? 'نصيحة: حدد أي كلمة واضغط على "عريض" (**نص**) أو "تمييز" (==نص==) لتظهر منسقة في الفاتورة والـ PDF.'
            : 'Tip: Highlight text with ==highlight== or **bold** to format on invoices & PDFs.'}
        </span>
      </div>
    </div>
  )
}
