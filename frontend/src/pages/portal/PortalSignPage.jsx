import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import axios from 'axios'
import { fieldControlClass, sectionCardClass } from '../sales/salesUi'

const portalApi = axios.create({ baseURL: '/api/portal' })
portalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('portal_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default function PortalSignPage() {
  const { documentType = 'quotation', documentId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const [signedBy, setSignedBy] = useState('')
  const id = documentId || params.get('id')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'

    const pos = (e) => {
      const r = canvas.getBoundingClientRect()
      const t = e.touches?.[0]
      return {
        x: ((t ? t.clientX : e.clientX) - r.left) * (canvas.width / r.width),
        y: ((t ? t.clientY : e.clientY) - r.top) * (canvas.height / r.height),
      }
    }

    const start = (e) => { drawing.current = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault() }
    const move = (e) => { if (!drawing.current) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault() }
    const end = () => { drawing.current = false }

    canvas.addEventListener('mousedown', start)
    canvas.addEventListener('mousemove', move)
    window.addEventListener('mouseup', end)
    canvas.addEventListener('touchstart', start, { passive: false })
    canvas.addEventListener('touchmove', move, { passive: false })
    canvas.addEventListener('touchend', end)
    return () => {
      canvas.removeEventListener('mousedown', start)
      canvas.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', end)
      canvas.removeEventListener('touchstart', start)
      canvas.removeEventListener('touchmove', move)
      canvas.removeEventListener('touchend', end)
    }
  }, [])

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const submit = async () => {
    try {
      const signatureData = canvasRef.current.toDataURL('image/png')
      await portalApi.post(`/sign/${documentType}/${id}`, { signatureData, signedBy })
      toast.success('Document signed')
      navigate('/portal/documents')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Signature failed')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className={`${sectionCardClass} w-full max-w-lg space-y-4`}>
        <h1 className="text-xl font-semibold">Sign document</h1>
        <input className={fieldControlClass} placeholder="Full name" value={signedBy} onChange={(e) => setSignedBy(e.target.value)} />
        <canvas ref={canvasRef} width={640} height={240} className="w-full touch-none rounded-xl border border-slate-200 bg-white" />
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={clear}>Clear</button>
          <button type="button" className="btn btn-primary flex-1" onClick={submit} disabled={!id}>Submit signature</button>
        </div>
      </div>
    </div>
  )
}
