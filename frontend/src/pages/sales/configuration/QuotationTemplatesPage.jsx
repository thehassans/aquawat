import SalesConfigCrud from './SalesConfigCrud'

export default function QuotationTemplatesPage() {
  return (
    <SalesConfigCrud
      title="Quotation Templates"
      subtitle="Standardized offers with predefined products and terms"
      apiPath="/sales/quotation-templates"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'lines', label: 'Lines', render: (r) => r.lines?.length ?? 0 },
        { key: 'isActive', label: 'Active', render: (r) => (r.isActive !== false ? 'Yes' : 'No') },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'nameAr', label: 'Name (AR)' },
        { key: 'terms', label: 'Terms & conditions' },
        { key: 'headerHtml', label: 'Header HTML' },
        { key: 'footerHtml', label: 'Footer HTML' },
      ]}
    />
  )
}
