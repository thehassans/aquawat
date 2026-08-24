import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Plus } from 'lucide-react'
import api from '../../lib/api'
import ResponsiveDataList from '../../components/ui/ResponsiveDataList'
import EmptyState from '../../components/ui/EmptyState'
import {
  INVENTORY_PATH,
  primaryBtn,
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
  const [params] = useSearchParams()
  const stateFilter = params.get('state') || ''
  const search = params.get('search') || ''
  const page = Number(params.get('page') || 1)

  const { data, isLoading } = useQuery({
    queryKey: ['stock-pickings', code, stateFilter, search, page],
    queryFn: () =>
      api
        .get('/stock/pickings', {
          params: { code, state: stateFilter || undefined, search: search || undefined, page, limit: 80 },
        })
        .then((r) => r.data),
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

      <ResponsiveDataList
        columns={columns}
        data={items}
        loading={isLoading}
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
          onPageChange: () => {},
        }}
      />
    </div>
  )
}
