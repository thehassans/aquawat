/** FBR Digital Invoicing applies to PKR (Pakistan) tenants. */
export function isFbrCurrency(tenant) {
  const currency = String(tenant?.settings?.currency || tenant?.currency || '').trim().toUpperCase()
  return currency === 'PKR'
}

export const isPakistanTenant = isFbrCurrency
