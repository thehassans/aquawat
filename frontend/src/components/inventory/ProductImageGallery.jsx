import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ImagePlus, Star, Trash2, GripVertical } from 'lucide-react'
import api from '../../lib/api'

/**
 * Product image gallery — main + up to 8 extras.
 * Uploads via POST /products/:id/images (WebP + thumb).
 */
export default function ProductImageGallery({
  productId,
  images = [],
  language = 'en',
  disabled = false,
}) {
  const ar = language === 'ar'
  const qc = useQueryClient()
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const sorted = [...(images || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['product', productId] })
    qc.invalidateQueries({ queryKey: ['products'] })
  }

  const upload = useMutation({
    mutationFn: async (file) => {
      const fd = new FormData()
      fd.append('image', file)
      return api.post(`/products/${productId}/images`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      toast.success(ar ? 'تم رفع الصورة' : 'Image uploaded')
      invalidate()
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const patch = useMutation({
    mutationFn: (body) => api.patch(`/products/${productId}/images`, body),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const onFiles = (files) => {
    const list = [...(files || [])]
    for (const f of list) {
      if (f.size > 5 * 1024 * 1024) {
        toast.error(ar ? 'الحد 5 ميجا' : 'Max 5MB')
        continue
      }
      upload.mutate(f)
    }
  }

  if (!productId) {
    return (
      <p className="text-sm text-slate-400">
        {ar ? 'احفظ المنتج أولاً ثم أضف الصور.' : 'Save the product first, then add images.'}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div
        className={`rounded-xl border-2 border-dashed p-4 transition ${
          dragOver ? 'border-primary-400 bg-primary-50/50' : 'border-slate-200 dark:border-dark-600'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (!disabled) onFiles(e.dataTransfer.files)
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={disabled || upload.isPending || sorted.length >= 9}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
            {ar ? 'رفع' : 'Upload'}
          </button>
          <span className="text-xs text-slate-400">
            {ar ? 'JPG / PNG / WebP · حتى 5MB · صورة رئيسية + 8' : 'JPG / PNG / WebP · 5MB · main + 8'}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            multiple
            onChange={(e) => onFiles(e.target.files)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {sorted.map((img, idx) => (
          <div
            key={img.url}
            className={`relative overflow-hidden rounded-xl border ${
              img.isPrimary ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-slate-200 dark:border-dark-600'
            }`}
          >
            <img
              src={img.thumbUrl || img.url}
              alt={img.alt || ''}
              className="aspect-square w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/50 px-1.5 py-1">
              <button
                type="button"
                className="rounded p-1 text-white/80 hover:bg-white/20"
                title={ar ? 'ترتيب' : 'Reorder'}
                disabled={disabled || idx === 0}
                onClick={() => {
                  const order = sorted.map((x) => x.url)
                  ;[order[idx - 1], order[idx]] = [order[idx], order[idx - 1]]
                  patch.mutate({ order })
                }}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="rounded p-1 text-amber-300 hover:bg-white/20"
                title={ar ? 'رئيسية' : 'Set main'}
                disabled={disabled || img.isPrimary}
                onClick={() => patch.mutate({ primaryUrl: img.url })}
              >
                <Star className={`h-3.5 w-3.5 ${img.isPrimary ? 'fill-current' : ''}`} />
              </button>
              <button
                type="button"
                className="rounded p-1 text-rose-300 hover:bg-white/20"
                disabled={disabled}
                onClick={() => patch.mutate({ removeUrl: img.url })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
