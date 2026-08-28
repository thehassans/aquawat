import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import axios from 'axios'
import { fieldControlClass, sectionCardClass } from '../sales/salesUi'

const portalApi = axios.create({ baseURL: '/api/portal' })

export default function PortalAcceptInvitePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''
  const isMagic = params.get('magic') === '1'
  const [form, setForm] = useState({ password: '', name: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isMagic || !token) return
    setBusy(true)
    portalApi.post('/auth/magic-login', { token })
      .then(({ data }) => {
        localStorage.setItem('portal_token', data.token)
        toast.success('Signed in')
        navigate('/portal/documents')
      })
      .catch((err) => toast.error(err?.response?.data?.error || 'Magic link expired'))
      .finally(() => setBusy(false))
  }, [isMagic, token, navigate])

  const accept = async (e) => {
    e.preventDefault()
    try {
      const { data } = await portalApi.post('/auth/accept-invite', { token, ...form })
      localStorage.setItem('portal_token', data.token)
      toast.success('Invitation accepted')
      navigate('/portal/documents')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not accept invitation')
    }
  }

  if (isMagic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className={`${sectionCardClass} w-full max-w-md text-center`}>
          <p>{busy ? 'Signing you in…' : 'Completing magic link login…'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={accept} className={`${sectionCardClass} w-full max-w-md space-y-4`}>
        <h1 className="text-xl font-semibold">Accept portal invitation</h1>
        <input className={fieldControlClass} placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={fieldControlClass} type="password" placeholder="Choose password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button type="submit" className="btn btn-primary w-full" disabled={!token}>Activate account</button>
      </form>
    </div>
  )
}
