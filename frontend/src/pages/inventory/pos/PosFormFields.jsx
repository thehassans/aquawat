import PartnerCombobox from '../../../components/inventory/PartnerCombobox'
import { groupOperationTypesByWarehouse, operationTypeOptionLabel } from '../receipts/opTypeGroups'
import { filterReceiptLocations, locationOptionLabel } from '../receipts/locationLabel'

/**
 * PoS transfer fields — Walk-in customer via PartnerCombobox, Stock → Customers.
 */
export function PosFormFields({
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

  const groupLabel = (g) => {
    const code = String(g.warehouseLabel || '').split(':')[0].trim() || g.warehouseLabel
    return ar ? `${code}: نقطة البيع` : `${code}: PoS Orders`
  }

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

      <div className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          {ar ? 'العميل (افتراضي: زائر)' : 'Customer (default: Walk-in)'}
        </span>
        <PartnerCombobox
          role="customer"
          value={values?.partnerId || ''}
          selectedOption={selectedCustomer}
          disabled={readOnly}
          ar={ar}
          language={language}
          queryKeyPrefix="pos-customer-search"
          onChange={(id, opt) => {
            setValue('partnerId', id || '', { shouldDirty: true })
            onCustomerChange?.(opt)
          }}
        />
      </div>

      {multiLocations && (
        <>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              {ar ? 'مصدر نقطة البيع' : 'POS Source Location'}
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
              {ar ? 'الوجهة (عملاء)' : 'Destination (Customers)'}
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
          {ar ? 'مرجع الطلب' : 'Order Ref'}
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
