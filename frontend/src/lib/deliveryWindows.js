export const DELIVERY_WINDOWS = [
  { value: 'same_day', labelEn: 'Same Day Delivery', labelAr: 'تسليم نفس اليوم' },
  { value: 'morning', labelEn: 'Morning (8:00 AM - 12:00 PM)', labelAr: 'صباحي (8:00 ص - 12:00 ظ)' },
  { value: 'early_morning', labelEn: 'Early Morning (6:00 AM - 9:00 AM)', labelAr: 'فجر / صباح باكر (6:00 ص - 9:00 ص)' },
  { value: 'afternoon', labelEn: 'Afternoon (1:00 PM - 5:00 PM)', labelAr: 'بعد الظهر (1:00 ظ - 5:00 ع)' },
  { value: 'evening', labelEn: 'Evening (6:00 PM - 10:00 PM)', labelAr: 'مسائي (6:00 م - 10:00 م)' },
  { value: 'night', labelEn: 'Night / Late Shift (10:00 PM - 2:00 AM)', labelAr: 'ليلي متأخر (10:00 م - 2:00 ص)' },
  { value: 'urgent_1h', labelEn: 'Immediate Express (Within 1 Hour)', labelAr: 'تسليم فوري عاجل (خلال ساعة)' },
  { value: 'urgent_2h', labelEn: 'Urgent / Express (Within 2 Hours)', labelAr: 'تسليم عاجل (خلال ساعتين)' },
  { value: 'urgent_4h', labelEn: 'Priority Dispatch (Within 4 Hours)', labelAr: 'أولوية قصوى (خلال 4 ساعات)' },
  { value: 'next_day_morning', labelEn: 'Next Business Day Morning (8:00 AM - 12:00 PM)', labelAr: 'صباح يوم العمل التالي (8:00 ص - 12:00 ظ)' },
  { value: 'next_day_afternoon', labelEn: 'Next Business Day Afternoon (1:00 PM - 5:00 PM)', labelAr: 'بعد ظهر يوم العمل التالي (1:00 ظ - 5:00 ع)' },
  { value: 'next_day', labelEn: 'Next Business Day (Any Time)', labelAr: 'يوم العمل التالي (طوال اليوم)' },
  { value: 'scheduled_2_3_days', labelEn: 'Standard Shipping (2 - 3 Business Days)', labelAr: 'شحن قياسي (2 - 3 أيام عمل)' },
  { value: 'scheduled_custom', labelEn: 'Specific Date & Time Window', labelAr: 'موعد ووقت مخصص ومحدد' },
  { value: 'site_delivery', labelEn: 'Direct Job Site / Project Delivery', labelAr: 'تسليم مباشر لموقع العمل / المشروع' },
  { value: 'self_pickup', labelEn: 'Customer Warehouse Self-Pickup', labelAr: 'استلام ذاتي من المستودع / الفرع' },
]

export const getDeliveryWindowLabel = (value, language = 'en') => {
  if (!value) return '—'
  const found = DELIVERY_WINDOWS.find(w => w.value === value)
  if (!found) return value
  return language === 'ar' ? found.labelAr : found.labelEn
}
