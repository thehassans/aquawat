import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { getPrimaryBusinessType } from '../../lib/businessTypes'

/**
 * Redirect legacy customer/supplier list routes to the unified Contacts hub.
 * Bakala tenants keep separate list pages (Contacts hub is hidden in their sidebar).
 */
export function usePartnerHubRedirect(types) {
  const tenant = useSelector((state) => state.auth.tenant)
  const biz = getPrimaryBusinessType(tenant)
  if (biz === 'bakala') return null
  return `/app/dashboard/contacts?types=${types}`
}

export function PartnerHubRedirect({ types, children }) {
  const target = usePartnerHubRedirect(types)
  if (target) return <Navigate to={target} replace />
  return children
}
