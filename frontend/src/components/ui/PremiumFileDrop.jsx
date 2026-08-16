import { useRef, useState } from 'react'
import { FileText, ImageIcon, Paperclip, Upload, X } from 'lucide-react'

const ACCEPT_DEFAULT = 'application/pdf,image/jpeg,image/png,image/webp'

function isImage(file) {
  return String(file?.type || file?.mimeType || '').startsWith('image/')
}

export default function PremiumFileDrop({
  language = 'en',
  disabled = false,
  accept = ACCEPT_DEFAULT,
  files = [],
  pendingFiles = [],
  onAdd,
  onRemovePending,
  onRemoveSaved,
  multiple = true,
  hint,
}) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const ar = language === 'ar'

  const addFiles = (list) => {
    const next = Array.from(list || [])
    if (!next.length || disabled) return
    onAdd?.(multiple ? next : next.slice(0, 1))
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
        className={`flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-7 text-center transition ${
          dragging
            ? 'border-teal-600 bg-teal-50/80 dark:border-teal-400 dark:bg-teal-500/10'
            : 'border-slate-200 bg-slate-50/70 hover:border-teal-500/60 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-teal-400/40'
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 dark:bg-[#121826] dark:ring-white/10">
          <Upload className="h-5 w-5 text-teal-700 dark:text-teal-300" />
        </span>
        <p className="mt-3 text-[13px] font-medium text-slate-900 dark:text-white">
          {ar ? 'أسقط الملف هنا أو اضغط للاختيار' : 'Drop a file here, or click to choose'}
        </p>
        <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
          {hint || (ar ? 'PDF أو صورة — حتى 10MB' : 'PDF or image — up to 10MB')}
        </p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {(files.length > 0 || pendingFiles.length > 0) && (
        <ul className="space-y-2">
          {files.map((file, idx) => (
            <li
              key={file.url || file.name || idx}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <a href={file.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2.5">
                {isImage(file) ? (
                  <ImageIcon className="h-4 w-4 shrink-0 text-teal-700" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-teal-700" />
                )}
                <span className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
                  {file.name || (ar ? 'مرفق' : 'Attachment')}
                </span>
              </a>
              {onRemoveSaved ? (
                <button type="button" onClick={() => onRemoveSaved(file, idx)} className="rounded-lg p-1 text-slate-400 hover:text-rose-600">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
          {pendingFiles.map((file, idx) => (
            <li
              key={`${file.name}-${idx}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2.5 dark:border-amber-500/20 dark:bg-amber-500/10"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Paperclip className="h-4 w-4 shrink-0 text-amber-800 dark:text-amber-300" />
                <span className="truncate text-[13px] font-medium text-amber-950 dark:text-amber-100">{file.name}</span>
              </span>
              <button type="button" onClick={() => onRemovePending?.(idx)} className="rounded-lg p-1 text-amber-700 hover:text-rose-600">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
