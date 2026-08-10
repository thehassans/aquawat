import { useQuery } from '@tanstack/react-query'
import api from './api'

export function usePublicWebsiteSettings() {
  return useQuery({
    queryKey: ['public-website-settings'],
    queryFn: () => api.get('/public/website').then((res) => res.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}

/** Fetches minimal branding (logo, name, colors) for a tenant alias login page. */
export function usePublicTenantBranding(slug) {
  return useQuery({
    queryKey: ['public-tenant-branding', slug],
    queryFn: () => api.get(`/public/tenant-branding/${encodeURIComponent(slug)}`).then((res) => res.data),
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
