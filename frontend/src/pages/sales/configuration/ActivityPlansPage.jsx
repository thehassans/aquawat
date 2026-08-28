import SalesConfigCrud from './SalesConfigCrud'

export default function ActivityPlansPage() {
  return (
    <SalesConfigCrud
      title="Activity Plans"
      subtitle="Schedule follow-up sequences on quotations"
      apiPath="/sales/activity-plans"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'appliesTo', label: 'Applies to' },
        { key: 'steps', label: 'Steps', render: (r) => (r.steps?.length ?? 0) },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'nameAr', label: 'Name (AR)' },
        { key: 'description', label: 'Description' },
        { key: 'appliesTo', label: 'Applies to', type: 'select', default: 'quotation', options: [
          { value: 'quotation', label: 'Quotation' },
          { value: 'sales_order', label: 'Sales Order' },
          { value: 'partner', label: 'Partner' },
        ] },
      ]}
    />
  )
}
