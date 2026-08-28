import SalesConfigCrud from './SalesConfigCrud'

export default function CarrierConnectorsPage() {
  return (
    <SalesConfigCrud
      title="Shipping Connectors"
      subtitle="UPS, DHL, FedEx, USPS, bpost, Easypost, Sendcloud"
      apiPath="/sales/carrier-connectors"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'provider', label: 'Provider' },
        { key: 'isActive', label: 'Active', render: (r) => (r.isActive ? 'Yes' : 'No') },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'provider', label: 'Provider', type: 'select', default: 'internal', options: [
          { value: 'internal', label: 'Internal' },
          { value: 'ups', label: 'UPS' },
          { value: 'dhl', label: 'DHL Express' },
          { value: 'fedex', label: 'FedEx' },
          { value: 'usps', label: 'USPS' },
          { value: 'bpost', label: 'bpost' },
          { value: 'easypost', label: 'Easypost' },
          { value: 'sendcloud', label: 'Sendcloud' },
        ] },
      ]}
    />
  )
}
