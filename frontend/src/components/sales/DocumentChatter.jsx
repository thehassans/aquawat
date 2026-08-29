import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, ghostActionClass, sectionCardClass } from '../../pages/sales/salesUi'

/**
 * Chatter / audit trail for SO, DN, Invoice.
 * docType: sales_order | delivery_note | invoice
 */
export default function DocumentChatter({ docType, docId, language = 'en' }) {
  const isAr = language === 'ar'
  const qc = useQueryClient()
  const [body, setBody] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['sales-chatter', docType, docId],
    queryFn: async () => (await api.get(`/sales/chatter/${docType}/${docId}`)).data,
    enabled: Boolean(docType && docId),
  })

  const post = useMutation({
    mutationFn: () => api.post(`/sales/chatter/${docType}/${docId}`, { body }),
    onSuccess: () => {
      setBody('')
      qc.invalidateQueries({ queryKey: ['sales-chatter', docType, docId] })
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  })

  const messages = data?.messages || []

  return (
    <div className={`${sectionCardClass} space-y-3`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <MessageSquare className="h-4 w-4 text-slate-400" />
        {isAr ? 'المحادثة والسجل' : 'Chatter'}
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {isLoading ? <p className="text-xs text-slate-400">…</p> : null}
        {!isLoading && !messages.length ? (
          <p className="text-xs text-slate-400">{isAr ? 'لا رسائل بعد' : 'No messages yet'}</p>
        ) : null}
        {messages.map((m) => (
          <div
            key={m._id}
            className={`rounded-xl border px-3 py-2 text-xs ${
              m.kind === 'system'
                ? 'border-slate-100 bg-slate-50 text-slate-600 dark:border-dark-600 dark:bg-dark-800/60 dark:text-slate-300'
                : 'border-emerald-100 bg-emerald-50/50 text-slate-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-slate-100'
            }`}
          >
            <div className="mb-0.5 flex justify-between gap-2 text-[10px] uppercase tracking-wide text-slate-400">
              <span>
                {m.kind === 'system'
                  ? (isAr ? 'نظام' : 'System')
                  : `${m.createdBy?.firstName || ''} ${m.createdBy?.lastName || ''}`.trim() || m.createdBy?.email || 'User'}
              </span>
              <span>{m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</span>
            </div>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className={fieldControlClass}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={isAr ? 'أضف ملاحظة داخلية…' : 'Add an internal note…'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && body.trim()) post.mutate()
          }}
        />
        <button
          type="button"
          className={ghostActionClass}
          disabled={!body.trim() || post.isPending}
          onClick={() => post.mutate()}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
