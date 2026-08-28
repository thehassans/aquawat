/** Whether the user may see cost/margin columns on sales documents */
export function canViewSalesMargin(user) {
  if (!user) return false
  if (['admin', 'superadmin', 'super_admin', 'owner', 'manager'].includes(user.role)) return true

  const perms = Array.isArray(user.permissions) ? user.permissions : []
  const sales = perms.find((p) => p?.module === 'sales')
  if (sales?.actions?.includes('margin')) return true

  const finance = perms.find((p) => p?.module === 'finance')
  return finance?.actions?.includes('read') || finance?.actions?.includes('export')
}
