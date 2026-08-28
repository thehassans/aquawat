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
      ]}
    />
  )
}
