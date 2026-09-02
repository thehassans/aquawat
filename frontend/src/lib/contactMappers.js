/** Map unified /contacts row → legacy customer JSON shape */
export function contactToCustomer(c) {
  if (!c) return c
  return {
    _id: c.entityId,
    name: c.displayName,
    nameEn: c.displayName,
    nameAr: c.displayNameAr,
    customerCode: c.code,
    phone: c.phone,
    mobile: c.phone,
    email: c.email,
    vatNumber: c.vatNumber,
    taxNumber: c.vatNumber,
    crNumber: c.crNumber || '',
    address: c.address || null,
    isActive: c.isActive !== false,
    type: c.partnerType === 'individual' ? 'individual' : 'business',
  }
}

/** Map unified /contacts row → legacy supplier JSON shape */
export function contactToSupplier(c) {
  if (!c) return c
  return {
    _id: c.entityId,
    name: c.displayName,
    nameEn: c.displayName,
    nameAr: c.displayNameAr,
    code: c.code,
    phone: c.phone,
    email: c.email,
    vatNumber: c.vatNumber,
    isActive: c.isActive !== false,
  }
}

export async function fetchContactsList(api, { types, page = 1, limit = 50, isActive = 'all', search } = {}) {
  const res = await api.get('/contacts', {
    params: {
      types,
      page,
      limit,
      isActive,
      search: search || undefined,
    },
  })
  return {
    contacts: res.data?.contacts || [],
    pagination: res.data?.pagination,
  }
}
