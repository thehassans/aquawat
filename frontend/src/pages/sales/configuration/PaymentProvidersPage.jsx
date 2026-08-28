import SalesConfigCrud from './SalesConfigCrud'

export default function PaymentProvidersPage() {
  return (
    <SalesConfigCrud
      title="Payment Providers"
      subtitle="Configure Moyasar, Stripe, Tabby, Tamara, and custom gateways"
      apiPath="/sales/payment-providers"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Provider' },
        { key: 'isActive', label: 'Active', render: (r) => (r.isActive ? 'Yes' : 'No') },
        { key: 'isTestMode', label: 'Test mode', render: (r) => (r.isTestMode ? 'Yes' : 'No') },
      ]}
      fields={[
        { key: 'name', label: 'Display name' },
        { key: 'code', label: 'Provider', type: 'select', default: 'moyasar', options: [
          { value: 'moyasar', label: 'Moyasar' },
          { value: 'stripe', label: 'Stripe' },
          { value: 'tabby', label: 'Tabby' },
          { value: 'tamara', label: 'Tamara' },
          { value: 'apple_pay', label: 'Apple Pay' },
          { value: 'manual', label: 'Manual' },
        ] },
      ]}
    />
  )
}
