import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Smartphone, QrCode, LogOut, RefreshCw, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'

function InfoBox({ icon: Icon = Info, title, children, variant = 'info' }) {
  const styles = {
    info: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    warning: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    success: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
  }
  const iconStyles = {
    info: 'text-blue-600 dark:text-blue-400',
    warning: 'text-amber-600 dark:text-amber-400',
    success: 'text-emerald-600 dark:text-emerald-400',
  }
  return (
    <div className={`rounded-2xl border p-4 ${styles[variant]}`}>
      <div className="flex gap-3">
        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconStyles[variant]}`} />
        <div>
          {title && <p className="font-semibold text-sm mb-1">{title}</p>}
          <div className="text-sm leading-relaxed opacity-90">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default function SuperAdminWhatsApp() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['super-admin-whatsapp-status'],
    queryFn: () => api.get('/super-admin/whatsapp/status').then(r => r.data),
    refetchInterval: (data) => (data?.status === 'QR_READY' || data?.status === 'INITIALIZING' ? 4000 : false),
  })

  const initMutation = useMutation({
    mutationFn: () => api.post('/super-admin/whatsapp/init'),
    onSuccess: () => {
      toast.success('Initializing WhatsApp session...')
      refetch()
    }
  })

  const logoutMutation = useMutation({
    mutationFn: () => api.post('/super-admin/whatsapp/logout'),
    onSuccess: () => {
      toast.success('WhatsApp disconnected')
      refetch()
    }
  })

  if (isLoading) return (
    <div className="space-y-4 animate-pulse max-w-5xl">
      <div className="h-8 bg-gray-200 dark:bg-dark-700 rounded-xl w-64" />
      <div className="h-16 bg-gray-200 dark:bg-dark-700 rounded-2xl" />
      <div className="h-64 bg-gray-200 dark:bg-dark-700 rounded-2xl" />
    </div>
  )

  const state = data?.status || 'DISCONNECTED'
  const qrCode = data?.qrCode

  return (
    <div className="space-y-6 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            WhatsApp Integration
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-13">
            Manage your Super Admin WhatsApp connection
          </p>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <InfoBox icon={Smartphone} title="Automated Onboarding">
          Link your WhatsApp account to automatically send onboarding messages (Welcome, Credentials, Billing Cleared, and Terms &amp; Conditions PDF) to new tenants when you create them.
        </InfoBox>

        <div className="card rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-6 mt-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold">WhatsApp Status: {state}</h3>
            {state === 'CONNECTED' || state === 'READY' ? (
              <p className="text-green-600 font-medium mt-2">Your device is linked and ready to send onboarding messages!</p>
            ) : (
              <p className="text-gray-500 mt-2">Link your device to enable automated WhatsApp onboarding messages.</p>
            )}
          </div>

          {state === 'QR_READY' && qrCode && (
            <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 inline-block">
              <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
              <p className="text-sm text-gray-500 mt-4 font-medium">Open WhatsApp on your phone &gt; Linked Devices &gt; Link a Device</p>
            </div>
          )}

          {state === 'DISCONNECTED' && (
            <button 
              onClick={() => initMutation.mutate()} 
              disabled={initMutation.isPending}
              className="btn btn-primary gap-2"
            >
              <QrCode className="w-4 h-4" />
              {initMutation.isPending ? 'Generating QR...' : 'Link Device'}
            </button>
          )}

          {(state === 'CONNECTED' || state === 'READY') && (
            <button 
              onClick={() => logoutMutation.mutate()} 
              disabled={logoutMutation.isPending}
              className="btn btn-danger gap-2"
            >
              <LogOut className="w-4 h-4" />
              Unlink Device
            </button>
          )}
          
          {(state === 'INITIALIZING') && (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-primary-600 font-medium">
                <RefreshCw className="w-5 h-5 animate-spin" />
                Starting WhatsApp Engine...
              </div>
              <button
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="btn btn-secondary gap-2 text-sm"
              >
                <LogOut className="w-4 h-4" />
                Cancel & Retry
              </button>
            </div>
          )}

          {data?.error && (
            <div className="mt-2 p-4 rounded-xl bg-red-50 text-red-600 text-sm w-full text-left max-w-lg mx-auto">
              <strong>Error:</strong> {data.error}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
