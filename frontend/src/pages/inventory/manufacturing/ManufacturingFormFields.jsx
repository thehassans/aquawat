import AsyncCombobox from '../../../components/ui/AsyncCombobox'
import { groupOperationTypesByWarehouse, operationTypeOptionLabel } from '../receipts/opTypeGroups'
import { filterManufacturingLocations, locationOptionLabel } from '../receipts/locationLabel'

export const LOCATION_DIFF_MSG = 'Source and Destination locations must be different.'

/**
 * Manufacturing metadata — partner hidden by default; locations include virtual Production.
 */
export function ManufacturingFormFields({
  ar,
  register,
  errors,
  setValue,
  opTypes,
  warehouses,
  locations,
  readOnly,
  onOperationTypeChange,
  values,
  watchSource,
  watchDest,
  selectedPartner,
  onPartnerChange,
  fetchPartners,
  showPartner,
  onTogglePartner,
}) {
  const groups = groupOperationTypesByWarehouse(opTypes, warehouses, ar)
  const locationOptions = filterManufacturingLocations(locations, {
    includeIds: [values?.sourceLocationId, values?.destLocationId],
  })

  const sourceId = watchSource ?? values?.sourceLocationId
  const destId = watchDest ?? values?.destLocationId
  const sameLocation = Boolean(sourceId && destId && String(sourceId) === String(destId))
  const diffError = errors?.destLocationId?.message || (sameLocation ? LOCATION_DIFF_MSG : '')

  const groupLabel = (g) => {
    const code = String(g.warehouseLabel || '').split(':')[0].trim() || g.warehouseLabel
    return ar ? `${code}: تصنيع` : `${code}: Manufacturing`
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          {ar ? 'نوع العملية' : 'Operation Type'}
        </span>
        <select
          className="select mt-0.5 w-full"
          disabled={readOnly || Boolean(values?._lockOperationType)}
          value={values?.operationTypeId || ''}
          onChange={(e) => onOperationTypeChange?.(e.target.value)}
        >
          <option value="">{ar ? '— اختر —' : '— Select —'}</option>
          {groups.map((g) => (
            <optgroup key={g.warehouseId} label={groupLabel(g)}>
              {g.options.map((o) => (
                <option key={o._id} value={o._id}>
                  {operationTypeOptionLabel(o, ar)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {errors?.operationTypeId && (
          <p className="mt-1 text-xs text-rose-600">{errors.operationTypeId.message}</p>
        )}
      </label>

      {!showPartner ? (
        <div className="sm:col-span-2">
          <button
            type="button"
            className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-300"
            onClick={onTogglePartner}
            disabled={readOnly}
          >
            {ar ? '+ ربط شريك (اختياري)' : '+ Link partner (optional)'}
          </button>
        </div>
      ) : (
        <div className="block text-sm sm:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {ar ? 'الشريك (اختياري)' : 'Partner (optional)'}
            </span>
            <button
              type="button"
              className="text-[11px] text-slate-400 hover:text-slate-600"
              onClick={() => {
                setValue?.('partnerId', '', { shouldDirty: true })
                onPartnerChange?.(null)
                onTogglePartner?.()
              }}
              disabled={readOnly}
            >
              {ar ? 'إخفاء' : 'Hide'}
            </button>
          </div>
          <AsyncCombobox
            value={values?.partnerId || ''}
            selectedOption={selectedPartner}
            disabled={readOnly}
            debounceMs={300}
            minChars={2}
            queryKeyPrefix="mfg-partner-search"
            fetchOptions={fetchPartners}
            placeholder={ar ? 'ابحث عن شريك…' : 'Search partner…'}
            noResultsText={ar ? 'لا توجد نتائج' : 'No results found'}
            getOptionLabel={(c) => (ar && c.nameAr ? c.nameAr : c.name) || c.customerCode || '—'}
            getOptionSub={(c) => [c.customerCode, c.phone || c.mobile].filter(Boolean).join(' · ')}
            onChange={(id, opt) => {
              setValue?.('partnerId', id || '', { shouldDirty: true })
              onPartnerChange?.(opt)
            }}
          />
        </div>
      )}

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          {ar ? 'من موقع' : 'Source Location'}
          <span className="text-rose-500"> *</span>
        </span>
        <select
          className={`select mt-0.5 w-full ${sameLocation ? 'border-rose-400' : ''}`}
          disabled={readOnly}
          {...register('sourceLocationId')}
        >
          <option value="">—</option>
          {locationOptions.map((l) => (
            <option key={l._id} value={l._id}>{locationOptionLabel(l, ar)}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          {ar ? 'إلى موقع' : 'Destination Location'}
          <span className="text-rose-500"> *</span>
        </span>
        <select
          className={`select mt-0.5 w-full ${sameLocation ? 'border-rose-400' : ''}`}
          disabled={readOnly}
          {...register('destLocationId')}
        >
          <option value="">—</option>
          {locationOptions.map((l) => (
            <option key={l._id} value={l._id}>{locationOptionLabel(l, ar)}</option>
          ))}
        </select>
        {diffError ? (
          <p className="mt-1 text-xs text-rose-600">
            {ar ? 'يجب أن يختلف موقع المصدر عن الوجهة.' : LOCATION_DIFF_MSG}
          </p>
        ) : null}
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          {ar ? 'الموعد المجدول' : 'Scheduled Date'}
        </span>
        <input type="datetime-local" className="input mt-0.5 w-full" disabled={readOnly} {...register('scheduledDate')} />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          {ar ? 'المستند المصدر' : 'Source Document'}
        </span>
        <input className="input mt-0.5 w-full" disabled={readOnly} {...register('origin')} />
      </label>

      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          {ar ? 'ملاحظة' : 'Note'}
        </span>
        <textarea className="input mt-0.5 w-full" rows={2} disabled={readOnly} {...register('note')} />
      </label>
    </div>
  )
}
