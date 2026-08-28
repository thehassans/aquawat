import { useEffect, useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { PenLine, X } from 'lucide-react'

/**
 * Proof-of-delivery signature capture — mouse + touch.
 * Returns Base64 PNG via onConfirm({ signature, signedBy }).
 */
export default function CaptureSignatureModal({
  open,
  onClose,
  onConfirm,
  language = 'en',
  pending = false,
  defaultName = '',
}) {
  const ar = language === 'ar'
  const sigRef = useRef(null)
  const [signedBy, setSignedBy] = useState(defaultName || '')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setSignedBy(defaultName || '')
      setError('')
      // Clear after mount so canvas is ready
      requestAnimationFrame(() => {
        try { sigRef.current?.clear() } catch { /* ignore */ }
      })
    }
  }, [open, defaultName])

  if (!open) return null

  const clear = () => {
    sigRef.current?.clear()
    setError('')
  }

  const submit = () => {
    const name = String(signedBy || '').trim()
    if (!name) {
      setError(ar ? 'أدخل اسم الموقّع' : 'Enter the signee name')
      return
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setError(ar ? 'التوقيع مطلوب' : 'Please sign before continuing')
      return
    }
    let dataUrl
    try {
      dataUrl = sigRef.current.getTrimmedCanvas().toDataURL('image/png')
    } catch {
      dataUrl = sigRef.current.toDataURL('image/png')
    }
    onConfirm({ signature: dataUrl, signedBy: name })
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 p-3 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-dark-600 dark:bg-dark-800">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-dark-600">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
              <PenLine className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {ar ? 'وقّع لتأكيد التسليم' : 'Sign to Confirm Delivery'}
              </h2>
              <p className="text-xs text-slate-500">
                {ar ? 'إثبات تسليم للمستلم' : 'Proof of delivery for the recipient'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-dark-700"
            onClick={onClose}
            disabled={pending}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="label">{ar ? 'اسم الموقّع' : 'Signee name'} *</label>
            <input
              type="text"
              className="input"
              value={signedBy}
              onChange={(e) => setSignedBy(e.target.value)}
              placeholder={ar ? 'اسم المستلم' : 'Recipient full name'}
              autoFocus
              disabled={pending}
            />
          </div>

          <div>
            <label className="label">{ar ? 'التوقيع' : 'Signature'}</label>
            <div
              className="overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 dark:border-dark-500 dark:bg-dark-900/50"
              style={{ touchAction: 'none' }}
            >
              <SignatureCanvas
                ref={sigRef}
                penColor="#0f172a"
                backgroundColor="rgba(0,0,0,0)"
                canvasProps={{
                  className: 'w-full h-44 sm:h-52',
                  style: { width: '100%', height: '100%', touchAction: 'none' },
                }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              {ar ? 'استخدم الماوس أو اللمس للتوقيع' : 'Sign with mouse or touch'}
            </p>
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4 dark:border-dark-600">
          <button type="button" className="btn btn-ghost text-sm" onClick={clear} disabled={pending}>
            {ar ? 'مسح' : 'Clear'}
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary text-sm" onClick={onClose} disabled={pending}>
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="button" className="btn btn-action-dark text-sm" onClick={submit} disabled={pending}>
              {pending ? (
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (ar ? 'توقيع واعتماد' : 'Sign & Validate')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
