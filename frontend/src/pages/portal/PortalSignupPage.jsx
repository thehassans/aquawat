import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import axios from 'axios'
import { fieldControlClass, sectionCardClass } from '../sales/salesUi'

const portalApi = axios.create({ baseURL: '/api/portal' })

export default function PortalSignupPage() {
  const navigate = useNavigate()
  const [portalMode, setPortalMode] = useState('invitation_only')
  const [form, setForm] = useState({ tenantId: '', partnerId: '', email: '', password: '', name: '' })

  useEffect(() => {
    portalApi.get('/tenant-by-host', { params: { host: window.location.host } })
      .then(({ data }) => {
        if (data?.tenant?._id) {
          setForm((p) => ({ ...p, tenantId: data.tenant._id }))
        }
        if (data?.portalSignupMode) setPortalMode(data.portalSignupMode)
      })
      .catch(() => {})
  }, [])

  const signup = async (e) => {
    e.preventDefault()
    if (portalMode !== 'free_signup') {
      toast.error('Free signup is not enabled for this tenant')
      return
    }
    try {
      const { data } = await portalApi.post('/auth/signup', form)
      localStorage.setItem('portal_token', data.token)
      toast.success('Account created')
      navigate('/portal/documents')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Signup failed')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={signup} className={`${sectionCardClass} w-full max-w-md space-y-4`}>
        <h1 className="text-xl font-semibold">Create portal account</h1>
        {!form.tenantId && (
          <input className={fieldControlClass} placeholder="Tenant ID" value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} required />
        )}
        <input className={fieldControlClass} placeholder="Customer (Partner) ID" value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })} required />
        <input className={fieldControlClass} placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={fieldControlClass} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className={fieldControlClass} type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button type="submit" className="btn btn-primary w-full" disabled={portalMode !== 'free_signup'}>
          {portalMode === 'free_signup' ? 'Sign up' : 'Signup by invitation only'}
        </button>
        <button type="button" className="text-sm text-teal-700" onClick={() => navigate('/portal/login')}>Already have an account?</button>
      </form>
    </div>
  )
}
