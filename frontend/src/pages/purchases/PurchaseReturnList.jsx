import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, PackageMinus, Anchor } from 'lucide-react'
import api from '../../lib/api'
import {
  PURCHASES_PATH,
  shell,
  primaryBtn,
  ghostBtn,
  fieldControlClass,
  STATUS_PILL,
  statusLabel,
  partyName,
  warehouseName,
  formatDay,
} from './purchasesUi'

export default function PurchaseReturnList() {
  const { language } = useSelector((state) => state.ui)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 280)
    return () => clearTimeout(h)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-returns', debounced, status],
    queryFn: () => api.get('/purchase-returns', { params: { search: debounced, status } }).then((res) => res.data),
  })
  const { data: grns = [] } = useQuery({
    queryKey: ['grn-list', 'returnable'],
    queryFn: () => api.get('/grn').then((res) => (Array.isArray(res.data) ? res.data : [])),
  })

  const rows = Array.isArray(data) ? data : []
  const receivableGrns = useMemo(
    () => (Array.isArray(grns) ? grns : []).filter((grn) => ['received', 'completed'].includes(grn.status)),
    [grns],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-700 dark:text-teal-300">
            {language === 'ar' ? 'المشتريات' : 'Purchases'}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-[30px]">
            {language === 'ar' ? 'مرتجعات المشتريات' : 'Purchase returns'}
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] leading-6 text-slate-500 dark:text-slate-400">
            {language === 'ar'
              ? 'أرجع كميات مستلمة من إشعار الاستلام وانقص المخزون من نفس المستودع.'
              : 'Return received quantities from a GRN and decrement the same warehouse.'}
          </p>
        </div>
        <Link to={`${PURCHASES_PATH.returns}/new`} className={primaryBtn}>
          <Plus className="h-4 w-4 opacity-80" />
          {language === 'ar' ? 'مرتجع جديد' : 'New return'}
        </Link>
      </div>

      <div className={`${shell} p-4`}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${fieldControlClass} ps-9`}
              placeholder={language === 'ar' ? 'بحث برقم المرتجع…' : 'Search return number…'}
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${fieldControlClass} sm:w-48`}>
            <option value="">{language === 'ar' ? 'كل الحالات' : 'All statuses'}</option>
            {['draft', 'completed', 'cancelled'].map((s) => (
              <option key={s} value={s}>{statusLabel(s, language)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={shell}>
        <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {language === 'ar' ? 'إشعارات الاستلام القابلة للإرجاع' : 'Received GRNs'}
          </p>
          <p className="mt-1 text-[13px] text-slate-500">
            {language === 'ar' ? 'كل إشعار استلام مكتمل يظهر هنا لإنشاء مرتجع أو تكلفة مرسية.' : 'Every received GRN can start a return or a landed-cost worksheet.'}
          </p>
        </div>
        {receivableGrns.length === 0 ? (
          <p className="px-5 py-8 text-[13px] text-slate-500">
            {language === 'ar' ? 'لا توجد إشعارات استلام مكتملة بعد.' : 'No received GRNs yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:border-white/10">
                <tr>
                  <th className="px-5 py-3">{language === 'ar' ? 'الإشعار' : 'GRN'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'المورد' : 'Vendor'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'طلب الشراء' : 'PO'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'المستودع' : 'Warehouse'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'التكلفة المرسية' : 'Landed cost'}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {receivableGrns.map((grn) => {
                  const landed = (grn.landedCosts || [])[0]
                  return (
                    <tr key={grn._id} className="border-b border-slate-50 dark:border-white/[0.04]">
                      <td className="px-5 py-4 font-mono text-[13px] font-semibold text-slate-900 dark:text-white">{grn.grnNumber}</td>
                      <td className="px-5 py-4">{partyName(grn.supplierId, language)}</td>
                      <td className="px-5 py-4 font-mono text-[12px] text-slate-500">{grn.purchaseOrderId?.poNumber || '—'}</td>
                      <td className="px-5 py-4">{warehouseName(grn.warehouseId, language)}</td>
                      <td className="px-5 py-4 text-[12px] text-slate-600">
                        {landed ? `${landed.lcNumber}` : (language === 'ar' ? 'غير مكتوبة' : 'Not written')}
                      </td>
                      <td className="px-5 py-4 text-end">
                        <div className="flex justify-end gap-2">
                          <Link to={`${PURCHASES_PATH.returns}/new?grnId=${grn._id}`} className={ghostBtn.replace('px-3.5 py-2.5', 'px-3 py-1.5 text-[12px]')}>
                            <PackageMinus className="h-3.5 w-3.5" />
                            {language === 'ar' ? 'مرتجع' : 'Return'}
                          </Link>
                          <Link to={`${PURCHASES_PATH.landed}/new?grn=${grn._id}`} className={ghostBtn.replace('px-3.5 py-2.5', 'px-3 py-1.5 text-[12px]')}>
                            <Anchor className="h-3.5 w-3.5" />
                            {language === 'ar' ? 'تكلفة مرسية' : 'Landed cost'}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={shell}>
        {isLoading ? (
          <div className="flex justify-center p-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-500/10">
              <PackageMinus className="h-7 w-7" />
            </div>
            <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
              {language === 'ar' ? 'لا توجد مرتجعات بعد' : 'No purchase returns yet'}
            </p>
            <Link to={`${PURCHASES_PATH.returns}/new`} className={`${primaryBtn} mt-5`}>
              <Plus className="h-4 w-4" />
              {language === 'ar' ? 'مرتجع جديد' : 'New return'}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:border-white/10">
                <tr>
                  <th className="px-5 py-3">{language === 'ar' ? 'المرتجع' : 'Return'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'المورد' : 'Vendor'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'الإشعار' : 'GRN'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'المستودع' : 'Warehouse'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row._id}
                    onClick={() => navigate(`${PURCHASES_PATH.returns}/${row._id}`)}
                    className="cursor-pointer border-b border-slate-50 transition hover:bg-slate-50/80 dark:border-white/[0.04] dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-4 font-mono text-[13px] font-semibold text-slate-900 dark:text-white">{row.returnNumber}</td>
                    <td className="px-5 py-4">{partyName(row.supplierId, language)}</td>
                    <td className="px-5 py-4 font-mono text-[12px] text-slate-500">{row.grnId?.grnNumber || '—'}</td>
                    <td className="px-5 py-4">{warehouseName(row.warehouseId, language)}</td>
                    <td className="px-5 py-4 text-slate-500">{formatDay(row.dateReturned || row.createdAt, language)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_PILL[row.status] || STATUS_PILL.draft}`}>
                        {statusLabel(row.status, language)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
