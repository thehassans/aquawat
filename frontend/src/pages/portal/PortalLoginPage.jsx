import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import axios from 'axios'
import { fieldControlClass, sectionCardClass } from '../sales/salesUi'

const portalApi = axios.create({ baseURL: '/api/portal' })

export default function PortalLoginPage() {
  const navigate = useNavigate()
  const [tenantId, setTenantId] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    portalApi.get('/tenant-by-host', { params: { host: window.location.host } })
      .then(({ data }) => {
        if (data?.tenant?._id) {
          setTenantId(data.tenant._id)
          setTenantName(data.tenant.name || data.tenant.slug || '')
        }
      })
      .catch(() => {})
  }, [])

  const login = async (e) => {
    e.preventDefault()
    try {
      const { data } = await portalApi.post('/auth/login', { tenantId, email, password })
      localStorage.setItem('portal_token', data.token)
      toast.success('Welcome back')
      navigate('/portal/documents')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Login failed')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={login} className={`${sectionCardClass} w-full max-w-md space-y-4`}>
        <h1 className="text-xl font-semibold">Customer Portal</h1>
        {tenantName ? <p className="text-sm text-slate-500">{tenantName}</p> : null}
        {!tenantId && (
          <input className={fieldControlClass} placeholder="Tenant ID" value={tenantId} onChange={(e) => setTenantId(e.target.value)} required />
        )}
        <input className={fieldControlClass} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={fieldControlClass} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="btn btn-primary w-full">Sign in</button>
        <button type="button" className="text-sm text-teal-700" onClick={() => navigate('/portal/signup')}>Free sign up</button>
      </form>
    </div>
  )
}
