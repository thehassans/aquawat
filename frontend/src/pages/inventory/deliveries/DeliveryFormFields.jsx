import PartnerCombobox from '../../../components/inventory/PartnerCombobox'
import { groupOperationTypesByWarehouse, operationTypeOptionLabel } from '../receipts/opTypeGroups'
import { filterReceiptLocations, locationOptionLabel } from '../receipts/locationLabel'

/**
 * Metadata form for delivery orders.
 * Partner = async customer search with Quick Create / Advanced Create.
 */
export function DeliveryFormFields({
  ar,
  language,
  register,
  errors,
  setValue,
  opTypes,
  warehouses,
  locations,
  multiLocations,
  readOnly,
  onOperationTypeChange,
  values,
  selectedCustomer,
  onCustomerChange,
}) {
  const groups = groupOperationTypesByWarehouse(opTypes, warehouses, ar)
  const locationOptions = filterReceiptLocations(locations, {
    includeIds: [values?.sourceLocationId, values?.destLocationId],
  })

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm">
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

      <div className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          {ar ? 'تسليم إلى (العميل)' : 'Deliver To (Customer)'}
          <span className="text-rose-500"> *</span>
        </span>
        <PartnerCombobox
          role="customer"
          value={values?.partnerId || ''}
          selectedOption={selectedCustomer}
          disabled={readOnly}
          ar={ar}
          language={language}
          onChange={(id, opt) => {
            setValue('partnerId', id || '', { shouldDirty: true, shouldValidate: true })
            onCustomerChange?.(opt)
          }}
        />
        {errors?.partnerId && (
          <p className="mt-1 text-xs text-rose-600">{errors.partnerId.message}</p>
        )}
      </div>

      {multiLocations && (
        <>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              {ar ? 'موقع المصدر' : 'Source Location'}
            </span>
            <select className="select mt-0.5 w-full" disabled={readOnly} {...register('sourceLocationId')}>
              <option value="">—</option>
              {locationOptions.map((l) => (
                <option key={l._id} value={l._id}>{locationOptionLabel(l, ar)}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              {ar ? 'موقع الوجهة' : 'Destination Location'}
            </span>
            <select className="select mt-0.5 w-full" disabled={readOnly} {...register('destLocationId')}>
              <option value="">—</option>
              {locationOptions.map((l) => (
                <option key={l._id} value={l._id}>{locationOptionLabel(l, ar)}</option>
              ))}
            </select>
          </label>
        </>
      )}

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          {ar ? 'الموعد المجدول' : 'Scheduled Date'}
        </span>
        <input type="datetime-local" className="input mt-0.5 w-full" disabled={readOnly} {...register('scheduledDate')} />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          {ar ? 'آخر موعد' : 'Deadline'}
        </span>
        <input type="datetime-local" className="input mt-0.5 w-full" disabled={readOnly} {...register('deadlineDate')} />
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
        <input className="input mt-0.5 w-full" disabled={readOnly} {...register('origin')} placeholder="SO-…" />
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
