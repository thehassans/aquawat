import SalesConfigCrud from './SalesConfigCrud'

export default function PaymentMethodsPage() {
  return (
    <SalesConfigCrud
      title="Payment Methods"
      subtitle="Methods linked to payment providers"
      apiPath="/sales/payment-methods"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'type', label: 'Type' },
        { key: 'providerId', label: 'Provider' },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'nameAr', label: 'Name (AR)' },
        { key: 'providerId', label: 'Provider ID' },
        { key: 'type', label: 'Type', type: 'select', default: 'card', options: [
          { value: 'card', label: 'Card' },
          { value: 'bank', label: 'Bank' },
          { value: 'wallet', label: 'Wallet' },
          { value: 'bnpl', label: 'BNPL' },
          { value: 'cash', label: 'Cash' },
        ] },
      ]}
    />
  )
}
