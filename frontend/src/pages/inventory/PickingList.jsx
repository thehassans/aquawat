import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import EmptyState from '../../components/ui/EmptyState'
import InventoryDataTable from './InventoryDataTable'
import {
  INVENTORY_PATH,
  primaryBtn,
  ghostBtn,
  PICKING_STATUS_PILL,
  pickingStatusLabel,
  opTypeLabel,
} from './inventoryUi'

/**
 * @param {{ code: 'incoming'|'outgoing'|'internal', newPath: string }} props
 */
export default function PickingList({ code, newPath }) {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const stateFilter = params.get('state') || ''
  const search = params.get('search') || ''
  const page = Number(params.get('page') || 1)
  const [selectedIds, setSelectedIds] = useState([])

  const { data, isLoading } = useQuery({
    queryKey: ['stock-pickings', code, stateFilter, search, page],
    queryFn: () =>
      api
        .get('/stock/pickings', {
          params: { code, state: stateFilter || undefined, search: search || undefined, page, limit: 80 },
        })
        .then((r) => r.data),
  })

  const bulkMutation = useMutation({
    mutationFn: async ({ action, ids }) => {
      const results = await Promise.allSettled(
        ids.map((id) => api.post(`/stock/pickings/${id}/${action}`)),
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      if (failed) throw new Error(`${failed} failed`)
      return ids.length - failed
    },
    onSuccess: (count, { action }) => {
      toast.success(isAr ? `تم ${count} عملية` : `${count} transfers ${action}`)
      setSelectedIds([])
      queryClient.invalidateQueries(['stock-pickings'])
      queryClient.invalidateQueries(['stock-overview'])
    },
    onError: (err) => toast.error(err.message || 'Bulk action failed'),
  })

  const items = data?.items || []
  const total = data?.total || 0
  const title = opTypeLabel(code, language)

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: isAr ? 'المرجع' : 'Reference',
        render: (row) => (
          <Link to={INVENTORY_PATH.picking(row._id)} className="font-medium text-teal-700 hover:underline dark:text-teal-400">
            {row.name}
          </Link>
        ),
      },
      {
        key: 'state',
        label: isAr ? 'الحالة' : 'Status',
        render: (row) => (
          <span className={`badge ${PICKING_STATUS_PILL[row.state] || 'badge-neutral'}`}>
            {pickingStatusLabel(row.state, language)}
          </span>
        ),
      },
      {
        key: 'scheduledDate',
        label: isAr ? 'التاريخ' : 'Scheduled',
        render: (row) => (row.scheduledDate ? new Date(row.scheduledDate).toLocaleDateString() : '—'),
      },
      {
        key: 'origin',
        label: isAr ? 'المصدر' : 'Source document',
        render: (row) => row.origin || '—',
      },
    ],
    [isAr, language],
  )

  const stateFilters = ['', 'draft', 'assigned', 'done']

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {isAr ? `${total} عملية` : `${total} transfers`}
          </p>
        </div>
        <Link to={newPath} className={primaryBtn}>
          <Plus className="w-4 h-4" />
          {isAr ? 'جديد' : 'New'}
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {stateFilters.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params)
              if (s) next.set('state', s)
              else next.delete('state')
              next.set('page', '1')
              setParams(next)
            }}
            className={`rounded-lg px-3 py-1.5 text-sm ${stateFilter === s ? 'bg-teal-50 text-teal-800 dark:bg-teal-500/10' : 'text-slate-600 hover:bg-slate-50 dark:hover:bg-white/5'}`}
          >
            {s ? pickingStatusLabel(s, language) : (isAr ? 'الكل' : 'All')}
          </button>
        ))}
      </div>

      <InventoryDataTable
        columns={columns}
        data={items}
        loading={isLoading}
        selectable
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        empty={
          <EmptyState
            title={isAr ? 'لا توجد عمليات' : 'No transfers yet'}
            description={isAr ? 'أنشئ عملية جديدة للبدء' : 'Create a new transfer to get started'}
            actionLabel={isAr ? 'جديد' : 'New'}
            actionTo={newPath}
          />
        }
        pagination={{
          page,
          total,
          limit: 80,
          totalLabel: isAr ? 'عملية' : 'transfers',
          onPageChange: (p) => {
            const next = new URLSearchParams(params)
            next.set('page', String(p))
            setParams(next)
          },
        }}
      />

      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none"
          >
            <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-3 shadow-xl dark:border-white/10 dark:bg-[#0c111a]">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {selectedIds.length} {isAr ? 'محدد' : 'selected'}
              </span>
              <button
                type="button"
                className={ghostBtn}
                disabled={bulkMutation.isPending}
                onClick={() => bulkMutation.mutate({ action: 'confirm', ids: selectedIds })}
              >
                {isAr ? 'تأكيد' : 'Confirm'}
              </button>
              <button
                type="button"
                className={`${ghostBtn} text-rose-600`}
                disabled={bulkMutation.isPending}
                onClick={() => bulkMutation.mutate({ action: 'cancel', ids: selectedIds })}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="button" className="text-sm text-slate-500" onClick={() => setSelectedIds([])}>
                {isAr ? 'مسح' : 'Clear'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
