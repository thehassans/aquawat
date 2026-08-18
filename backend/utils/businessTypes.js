export const BUSINESS_TYPES = ['trading', 'construction', 'travel_agency', 'restaurant', 'car_rental', 'laundry', 'saloon', 'khayyat', 'boutique', 'manpower', 'bakala', 'pharmacy', 'car_workshop', 'bookstore', 'ecommerce', 'furniture_shop', 'manufacturing', 'gym']

export const normalizeBusinessTypes = (input, fallback = 'trading') => {
  const values = Array.isArray(input) ? input : [input]
  const normalized = values
    .map((value) => {
      const val = String(value || '').trim().toLowerCase();
      if (val === 'tailoring') return 'khayyat';
      if (val === 'supermarket' || val === 'super market') return 'bakala';
      if (val === 'صيدلية' || val === 'pharmacies') return 'pharmacy';
      return val;
    })
    .filter((value) => BUSINESS_TYPES.includes(value))

  if (normalized.length === 0) {
    return BUSINESS_TYPES.includes(fallback) ? [fallback] : ['trading']
  }

  return [...new Set(normalized)]
}

export const getTenantBusinessTypes = (tenant) => {
  if (Array.isArray(tenant?.businessTypes) && tenant.businessTypes.length > 0) {
    return normalizeBusinessTypes(tenant.businessTypes)
  }

  return normalizeBusinessTypes(tenant?.businessType)
}

export const getPrimaryBusinessType = (tenant) => getTenantBusinessTypes(tenant)[0] || 'trading'

export const tenantHasBusinessType = (tenant, businessType) => getTenantBusinessTypes(tenant).includes(businessType)
