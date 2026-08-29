import { useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import SalesConfigCrud from './SalesConfigCrud'
import { SALES_TEAM_TYPES } from '../salesConfig.menu'
import { fieldControlClass, fieldLabelClass } from '../salesUi'

export default function SalesTeamsPage() {
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const [typeFilter, setTypeFilter] = useState('')

  const columns = useMemo(
    () => [
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code' },
      {
        key: 'teamType',
        label: 'Type',
        render: (row) => {
          const t = SALES_TEAM_TYPES.find((x) => x.id === row.teamType)
          return (isAr ? t?.labelAr : t?.labelEn) || row.teamType || 'field'
        },
      },
      { key: 'monthlyTarget', label: 'Monthly target' },
      { key: 'quarterlyTarget', label: 'Quarterly target' },
    ],
    [isAr],
  )

  const filterFn = useMemo(
    () => (typeFilter ? (row) => String(row.teamType || 'field') === typeFilter : undefined),
    [typeFilter],
  )

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <label className={fieldLabelClass}>{isAr ? 'تصفية حسب النوع' : 'Filter by type'}</label>
        <select
          className={fieldControlClass}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">{isAr ? 'كل الأنواع' : 'All types'}</option>
          {SALES_TEAM_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {isAr ? t.labelAr : t.labelEn}
            </option>
          ))}
        </select>
      </div>
      <SalesConfigCrud
        title="Sales Teams"
        subtitle={
          isAr
            ? 'فرق نقاط البيع والكiosk والميدان وغيرها — من الإعدادات أو مركز فرق المبيعات'
            : 'POS, kiosk, field, and other sales teams — create from settings or the Sales team hub'
        }
        apiPath="/sales/teams"
        columns={columns}
        filterFn={filterFn}
        fields={[
          { key: 'name', label: 'Name' },
          { key: 'nameAr', label: 'Name (AR)' },
          { key: 'code', label: 'Code' },
          {
            key: 'teamType',
            label: 'Team type',
            type: 'select',
            default: 'field',
            options: SALES_TEAM_TYPES.map((t) => ({
              value: t.id,
              label: isAr ? t.labelAr : t.labelEn,
            })),
          },
          { key: 'monthlyTarget', label: 'Monthly target', type: 'number', default: 0 },
          { key: 'quarterlyTarget', label: 'Quarterly target', type: 'number', default: 0 },
          { key: 'description', label: 'Description' },
        ]}
      />
    </div>
  )
}
