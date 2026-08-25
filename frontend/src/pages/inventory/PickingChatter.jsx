import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, primaryBtn, ghostBtn } from './inventoryUi'

export default function PickingChatter({ pickingId }) {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const [asNote, setAsNote] = useState(false)

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['stock-messages', pickingId],
    queryFn: () =>
      api.get('/stock/messages', { params: { resModel: 'StockPicking', resId: pickingId } }).then((r) => r.data),
    enabled: Boolean(pickingId),
  })

  const post = useMutation({
    mutationFn: (payload) => api.post('/stock/messages', payload),
    onSuccess: () => {
      setBody('')
      queryClient.invalidateQueries(['stock-messages', pickingId])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <div className="card p-4 space-y-4">
      <h2 className="font-medium">{isAr ? 'النشاط' : 'Activity'}</h2>
      <div className="space-y-2 max-h-64 overflow-auto">
        {isLoading && <p className="text-sm text-slate-500">…</p>}
        {!isLoading && !messages.length && (
          <p className="text-sm text-slate-500">{isAr ? 'لا رسائل بعد' : 'No messages yet'}</p>
        )}
        {messages.map((m) => (
          <div
            key={m._id}
            className={`text-sm rounded-xl px-3 py-2 ${
              m.messageType === 'notification'
                ? 'bg-slate-50 dark:bg-dark-800 text-slate-600'
                : m.messageType === 'note'
                  ? 'bg-amber-50 dark:bg-amber-500/10'
                  : 'bg-teal-50 dark:bg-teal-500/10'
            }`}
          >
            <div className="flex justify-between gap-2 text-xs text-slate-500 mb-1">
              <span>{m.authorName || '—'}</span>
              <span>{m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</span>
            </div>
            <div className="whitespace-pre-wrap">{m.body}</div>
          </div>
        ))}
      </div>
      <textarea
        className={fieldControlClass}
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={isAr ? 'أضف رسالة أو ملاحظة…' : 'Add a message or note…'}
      />
      <div className="flex flex-wrap gap-2 items-center">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={asNote} onChange={(e) => setAsNote(e.target.checked)} />
          {isAr ? 'ملاحظة داخلية' : 'Log note'}
        </label>
        <button
          type="button"
          className={primaryBtn}
          disabled={!body.trim() || post.isPending}
          onClick={() => post.mutate({
            resModel: 'StockPicking',
            resId: pickingId,
            body: body.trim(),
            messageType: asNote ? 'note' : 'comment',
          })}
        >
          {isAr ? 'إرسال' : 'Send'}
        </button>
        <button type="button" className={ghostBtn} onClick={() => setBody('')}>
          {isAr ? 'مسح' : 'Clear'}
        </button>
      </div>
    </div>
  )
}
