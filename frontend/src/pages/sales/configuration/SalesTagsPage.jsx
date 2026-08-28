import SalesConfigCrud from './SalesConfigCrud'

export default function SalesTagsPage() {
  return (
    <SalesConfigCrud
      title="CRM Tags"
      subtitle="Color-coded tags for sales orders, quotations, and opportunities"
      apiPath="/sales/tags"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'color', label: 'Color', render: (r) => (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: r.color }} />
            {r.color}
          </span>
        ) },
        { key: 'scope', label: 'Scope' },
        { key: 'category', label: 'Category' },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'nameAr', label: 'Name (AR)' },
        { key: 'color', label: 'Color', type: 'color', default: '#14b8a6' },
        { key: 'scope', label: 'Scope', type: 'select', default: 'all', options: [
          { value: 'all', label: 'All' },
          { value: 'sales_order', label: 'Sales Order' },
          { value: 'quotation', label: 'Quotation' },
          { value: 'partner', label: 'Partner' },
          { value: 'product', label: 'Product' },
          { value: 'opportunity', label: 'Opportunity' },
        ] },
        { key: 'category', label: 'Category', type: 'select', default: 'custom', options: [
          { value: 'product_structure', label: 'Product structure' },
          { value: 'sales_type', label: 'Sales type' },
          { value: 'priority', label: 'Priority' },
          { value: 'custom', label: 'Custom' },
        ] },
      ]}
    />
  )
}
