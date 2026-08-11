import { Outlet, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

export default function AuthLayout() {
  const { isAuthenticated, user, token } = useSelector((state) => state.auth)

  // Only redirect when we are SURE the user is logged in (token + user).
  // Token is required: handoff used to set isAuthenticated via getMe while
  // Redux token stayed null, which bounced login ↔ dashboard until the
  // browser throttled navigation (white screen).
  if (token && isAuthenticated && user) {
    if (user?.role === 'super_admin') return <Navigate to="/super-admin" replace />
    if (user?.role === 'reseller') return <Navigate to="/reseller" replace />
    return <Navigate to="/app/dashboard" replace />
  }

  return <Outlet />
}
