import React, { useEffect, useRef, useState } from 'react'
import { Bold, Highlighter, List, Eraser, Sparkles } from 'lucide-react'
import { convertMarkdownToHtml, stripRichMarkup } from '../../lib/formatRichText'

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
  const editorRef = useRef(null)
  const [isEmpty, setIsEmpty] = useState(!value)
  const isInternalChangeRef = useRef(false)

  // Initialize and synchronize content
  useEffect(() => {
    if (!editorRef.current) return
    const currentHtml = editorRef.current.innerHTML
    const targetHtml = convertMarkdownToHtml(value || '')

    // Only update if externally changed to preserve user caret position
    if (!isInternalChangeRef.current && currentHtml !== targetHtml) {
      editorRef.current.innerHTML = targetHtml
      const plain = editorRef.current.innerText || ''
      setIsEmpty(!plain.trim())
    }
    isInternalChangeRef.current = false
  }, [value])

  const syncValue = () => {
    if (!editorRef.current) return
    const rawHtml = editorRef.current.innerHTML
    const plainText = editorRef.current.innerText || ''
    const isBlank = !plainText.trim() && !rawHtml.includes('<img')

    setIsEmpty(isBlank)
    isInternalChangeRef.current = true

    if (onChange) {
      onChange(isBlank ? '' : rawHtml)
    }
  }

  const executeCommand = (cmd, val = null) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand(cmd, false, val)
    syncValue()
  }

  const handleBold = (e) => {
    e.preventDefault()
    executeCommand('bold')
  }

  const handleHighlight = (e) => {
    e.preventDefault()
    if (!editorRef.current) return
    editorRef.current.focus()

    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0)
      const selectedContent = range.extractContents()

      // Create styled mark element
      const mark = document.createElement('mark')
      mark.className = 'bg-amber-200 text-amber-950 font-bold px-1 py-0.5 rounded'
      mark.style.backgroundColor = '#fef08a'
      mark.style.color = '#713f12'
      mark.style.fontWeight = 'bold'
      mark.style.padding = '2px 4px'
      mark.style.borderRadius = '4px'
      mark.appendChild(selectedContent)

      range.insertNode(mark)

      // Move caret after highlight
      range.setStartAfter(mark)
      range.setEndAfter(mark)
      selection.removeAllRanges()
      selection.addRange(range)

      syncValue()
    } else {
      // Insert placeholder highlighted text
      const placeholderText = isAr ? 'ملاحظة مميزة' : 'Important note'
      const htmlToInsert = `<mark style="background-color: #fef08a; color: #713f12; font-weight: bold; padding: 2px 4px; border-radius: 4px;">${placeholderText}</mark>&nbsp;`
      document.execCommand('insertHTML', false, htmlToInsert)
      syncValue()
    }
  }

  const handleList = (e) => {
    e.preventDefault()
    executeCommand('insertUnorderedList')
  }

  const handleClearFormat = (e) => {
    e.preventDefault()
    executeCommand('removeFormat')
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {label && (
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
            {label}
          </label>
        )}

        {/* Real Visual Formatting Toolbar */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200/90 bg-slate-50/90 p-1 shadow-2xs dark:border-dark-600 dark:bg-dark-800">
          <button
            type="button"
            onMouseDown={handleBold}
            title={isAr ? 'خط عريض (Bold)' : 'Bold (B)'}
            className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-black text-slate-800 hover:bg-white hover:text-black hover:shadow-2xs dark:text-slate-200 dark:hover:bg-dark-700 dark:hover:text-white"
          >
            <Bold className="h-3.5 w-3.5" />
            <span className="text-[11px] font-black">{isAr ? 'عريض' : 'Bold'}</span>
          </button>

          <button
            type="button"
            onMouseDown={handleHighlight}
            title={isAr ? 'تمييز باللون الأصفر (Highlight)' : 'Yellow Highlight'}
            className="flex h-7 items-center gap-1 rounded-lg bg-amber-100/90 px-2 text-xs font-bold text-amber-950 hover:bg-amber-200 hover:shadow-2xs dark:bg-amber-500/25 dark:text-amber-300 dark:hover:bg-amber-500/35"
          >
            <Highlighter className="h-3.5 w-3.5" />
            <span className="text-[11px]">{isAr ? 'تمييز' : 'Highlight'}</span>
          </button>

          <button
            type="button"
            onMouseDown={handleList}
            title={isAr ? 'قائمة نقطية (Bullet)' : 'Bullet list (•)'}
            className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-700 hover:bg-white hover:text-slate-900 hover:shadow-2xs dark:text-slate-300 dark:hover:bg-dark-700 dark:hover:text-white"
          >
            <List className="h-3.5 w-3.5" />
            <span className="text-[11px]">{isAr ? 'نقاط' : 'List'}</span>
          </button>

          <button
            type="button"
            onMouseDown={handleClearFormat}
            title={isAr ? 'مسح التنسيق' : 'Clear formatting'}
            className="flex h-7 items-center rounded-lg px-1.5 text-xs text-slate-500 hover:bg-white hover:text-slate-800 dark:hover:bg-dark-700 dark:hover:text-slate-200"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>

          {onRemove && (
            <>
              <div className="h-4 w-px bg-slate-200 dark:bg-dark-600 mx-0.5" />
              <button
                type="button"
                onClick={onRemove}
                className="text-[11px] font-bold text-slate-400 hover:text-red-600 px-1"
              >
                {isAr ? 'إزالة' : 'Remove'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Visual ContentEditable Editor Container */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={syncValue}
          onBlur={syncValue}
          dir={isAr ? 'rtl' : 'auto'}
          style={{ minHeight: `${rows * 26}px` }}
          className={`w-full rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-dark-600 dark:bg-dark-900 dark:text-white dark:focus:border-slate-500 [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5 [&_li]:mt-0.5 [&_strong]:font-extrabold [&_strong]:text-slate-950 dark:[&_strong]:text-white [&_mark]:bg-amber-200/90 [&_mark]:text-amber-950 [&_mark]:font-bold [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:rounded dark:[&_mark]:bg-amber-400/30 dark:[&_mark]:text-amber-100 ${fieldControlClass}`}
        />

        {/* Elegant Placeholder when empty */}
        {isEmpty && (
          <div
            onClick={() => editorRef.current && editorRef.current.focus()}
            dir={isAr ? 'rtl' : 'auto'}
            className="pointer-events-none absolute start-3 top-3 select-none text-xs text-slate-400 dark:text-slate-500"
          >
            {placeholder ||
              (isAr
                ? 'اكتب هنا... حدد أي نص واضغط على "عريض" أو "تمييز"'
                : 'Type here... select text and click Bold or Highlight')}
          </div>
        )}
      </div>

      {/* Helper Note */}
      <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-slate-400">
        <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
        <span>
          {isAr
            ? 'تنسيق مرئي مباشر: حدد أي كلمة واضغط على "عريض" أو "تمييز" لتظهر منسقة مباشرة.'
            : 'Visual rich editor: Select any text and click Bold or Highlight to format immediately.'}
        </span>
      </div>
    </div>
  )
}
