import SalesConfigCrud from './SalesConfigCrud'

export default function PromotionsPage() {
  return (
    <SalesConfigCrud
      title="Promotions & Coupons"
      subtitle="Coupon codes, loyalty, and gift card promotions"
      apiPath="/sales/promotions"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
        { key: 'promoType', label: 'Type' },
        { key: 'discountValue', label: 'Value' },
        { key: 'usedCount', label: 'Used', render: (r) => `${r.usedCount ?? 0}${r.maxUses != null ? ` / ${r.maxUses}` : ''}` },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Coupon code' },
        { key: 'promoType', label: 'Type', type: 'select', default: 'coupon', options: [
          { value: 'coupon', label: 'Coupon' },
          { value: 'loyalty', label: 'Loyalty' },
          { value: 'gift_card', label: 'Gift card' },
          { value: 'automatic', label: 'Automatic' },
        ] },
        { key: 'discountType', label: 'Discount type', type: 'select', default: 'percent', options: [
          { value: 'percent', label: 'Percent' },
          { value: 'fixed', label: 'Fixed amount' },
        ] },
        { key: 'discountValue', label: 'Discount value', type: 'number', default: 0 },
        { key: 'minOrderAmount', label: 'Min order', type: 'number', default: 0 },
        { key: 'maxUses', label: 'Max uses', type: 'number', default: '' },
        { key: 'validFrom', label: 'Valid from', type: 'date', default: '' },
        { key: 'validTo', label: 'Valid to', type: 'date', default: '' },
        { key: 'partnerIds', label: 'Partner IDs (comma-separated)', default: '', csvIds: true },
        { key: 'productIds', label: 'Product IDs (comma-separated)', default: '', csvIds: true },
      ]}
    />
  )
}
