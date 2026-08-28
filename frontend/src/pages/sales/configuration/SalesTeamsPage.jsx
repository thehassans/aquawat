import SalesConfigCrud from './SalesConfigCrud'

export default function SalesTeamsPage() {
  return (
    <SalesConfigCrud
      title="Sales Teams"
      subtitle="Group users and assign revenue targets (B2B, Retail, etc.)"
      apiPath="/sales/teams"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
        { key: 'monthlyTarget', label: 'Monthly target' },
        { key: 'quarterlyTarget', label: 'Quarterly target' },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'nameAr', label: 'Name (AR)' },
        { key: 'code', label: 'Code' },
        { key: 'monthlyTarget', label: 'Monthly target', type: 'number', default: 0 },
        { key: 'quarterlyTarget', label: 'Quarterly target', type: 'number', default: 0 },
        { key: 'description', label: 'Description' },
      ]}
    />
  )
}
