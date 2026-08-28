import SalesConfigCrud from './SalesConfigCrud'

export default function PricelistsPage() {
  return (
    <SalesConfigCrud
      title="Pricelists"
      subtitle="Multiple prices per product with volume and formula rules"
      apiPath="/sales/pricelists"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'currency', label: 'Currency' },
        { key: 'isDefault', label: 'Default', render: (r) => (r.isDefault ? 'Yes' : '') },
        { key: 'items', label: 'Items', render: (r) => r.items?.length ?? 0 },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'nameAr', label: 'Name (AR)' },
        { key: 'currency', label: 'Currency', default: 'SAR' },
      ]}
    />
  )
}
