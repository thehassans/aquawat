import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

function normalizeWarehouses(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.warehouses)) return payload.warehouses
  return []
}

/** Shared cached warehouse list — consistent shape across inventory pages. */
export function useWarehouses(options = {}) {
  return useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await api.get('/warehouses')
      return normalizeWarehouses(res.data)
    },
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}
