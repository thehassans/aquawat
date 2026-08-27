import { groupOperationTypesByWarehouse, operationTypeOptionLabel } from '../receipts/opTypeGroups'
import { filterReceiptLocations, locationOptionLabel } from '../receipts/locationLabel'

/**
 * Metadata for internal transfers — no partner; both locations are warehouse stock.
 */
export function InternalFormFields({
  ar,
  register,
  errors,
  opTypes,
  warehouses,
  locations,
  readOnly,
  onOperationTypeChange,
  values,
}) {
  const groups = groupOperationTypesByWarehouse(opTypes, warehouses, ar)
  const locationOptions = filterReceiptLocations(locations, {
    includeIds: [values?.sourceLocationId, values?.destLocationId],
  }).filter((l) => l.usage === 'internal' || String(values?.sourceLocationId) === String(l._id) || String(values?.destLocationId) === String(l._id))

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
            <optgroup key={g.warehouseId} label={g.warehouseLabel}>
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

      <>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              {ar ? 'من موقع' : 'From Location'}
              <span className="text-rose-500"> *</span>
            </span>
            <select className="select mt-0.5 w-full" disabled={readOnly} {...register('sourceLocationId')}>
              <option value="">—</option>
              {locationOptions.map((l) => (
                <option key={l._id} value={l._id}>{locationOptionLabel(l, ar)}</option>
              ))}
            </select>
            {errors?.sourceLocationId && (
              <p className="mt-1 text-xs text-rose-600">{errors.sourceLocationId.message}</p>
            )}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              {ar ? 'إلى موقع' : 'To Location'}
              <span className="text-rose-500"> *</span>
            </span>
            <select className="select mt-0.5 w-full" disabled={readOnly} {...register('destLocationId')}>
              <option value="">—</option>
              {locationOptions.map((l) => (
                <option key={l._id} value={l._id}>{locationOptionLabel(l, ar)}</option>
              ))}
            </select>
            {errors?.destLocationId && (
              <p className="mt-1 text-xs text-rose-600">{errors.destLocationId.message}</p>
            )}
          </label>
        </>

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          {ar ? 'الموعد المجدول' : 'Scheduled Date'}
        </span>
        <input type="datetime-local" className="input mt-0.5 w-full" disabled={readOnly} {...register('scheduledDate')} />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          {ar ? 'الأولوية' : 'Priority'}
        </span>
        <select className="select mt-0.5 w-full" disabled={readOnly} {...register('priority')}>
          <option value="normal">{ar ? 'عادي' : 'Normal'}</option>
          <option value="urgent">{ar ? 'عاجل' : 'Urgent'}</option>
        </select>
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
