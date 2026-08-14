import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldAlert, Search } from 'lucide-react'
import api from '../../lib/api'

const fontPage = { fontFamily: "'Plus Jakarta Sans', 'DM Sans', 'Tajawal', sans-serif" }
const fontDisplay = { fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }

export default function PharmacyControlledLog() {
  const [search, setSearch] = useState('')
  const { data = [], isLoading } = useQuery({
    queryKey: ['pharmacy-dispenses', 'controlled', search],
    queryFn: () => api.get('/pharmacy/dispenses', { params: { controlled: 'true', search } }).then((r) => r.data),
  })

  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data])

  return (
    <div className="relative -mx-4 -mt-4 min-h-[calc(100vh-4rem)] overflow-hidden px-4 pb-16 pt-6 lg:-mx-6 lg:px-6" style={fontPage}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-18%] h-[360px] w-[680px] -translate-x-1/2 rounded-full bg-amber-300/16 blur-[120px]" />
      </div>
      <div className="relative mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-800/80">Pharmacy</p>
            <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-950" style={fontDisplay}>Controlled-drug register</h1>
            <p className="mt-2 max-w-xl text-[15px] text-slate-500">Inspection log for controlled SKUs: patient, batch, and pharmacist note.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient or invoice…"
              className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/90 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.4)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Invoice</th>
                <th className="px-6 py-3.5">Patient</th>
                <th className="px-6 py-3.5">Controlled items</th>
                <th className="px-6 py-3.5">Pharmacist note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan="5" className="px-6 py-14 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" /></td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-800">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No controlled dispenses yet</p>
                    <p className="mt-1 text-xs text-slate-400">Mark a product as controlled, then sell it at POS.</p>
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row._id} className="hover:bg-amber-50/40">
                  <td className="px-6 py-4 text-slate-500">{row.dispensedAt ? new Date(row.dispensedAt).toLocaleString() : '—'}</td>
                  <td className="px-6 py-4 font-semibold text-slate-900">{row.invoiceNumber || '—'}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{row.patientName || '—'}</p>
                    <p className="text-xs text-slate-400">{row.prescriptionNumber || ''}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-700">
                    {(row.lines || []).filter((l) => l.isControlled).map((l) => `${l.productName} × ${l.quantity}`).join(', ') || '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-500">{row.pharmacistNote || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
