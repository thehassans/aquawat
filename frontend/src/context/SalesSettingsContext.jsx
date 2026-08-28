import { createContext, useContext, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import api from '../lib/api'

const SalesSettingsContext = createContext({
  settings: null,
  configuration: null,
  isLoading: false,
  refetch: () => {},
})

export function SalesSettingsProvider({ children }) {
  const token = useSelector((s) => s.auth?.token)
  const tenantId = useSelector((s) => s.auth?.tenant?._id || s.auth?.user?.tenantId)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sales-configuration', tenantId],
    queryFn: async () => {
      try {
        return (await api.get('/sales/configuration')).data
      } catch {
        const raw = (await api.get('/sales/settings')).data
        return {
          invoicing_policy: String(raw.defaultInvoicingPolicy || 'ordered').toUpperCase(),
          default_quotation_validity: raw.quotationValidityDays ?? 30,
          lock_confirmed_sales: raw.lockConfirmedOrders !== false,
          enable_sale_warnings: raw.enableSaleWarnings !== false,
          enable_proforma: raw.enableProforma !== false,
          require_online_signature: !!raw.requireOnlineSignature,
          require_online_payment: !!raw.requireOnlinePayment,
          raw,
        }
      }
    },
    enabled: Boolean(token && tenantId),
    staleTime: 60_000,
  })

  const value = useMemo(
    () => ({
      configuration: data || null,
      settings: data?.raw || data || null,
      isLoading,
      refetch,
      invoicingPolicy: data?.invoicing_policy || 'ORDERED',
      quotationValidityDays: data?.default_quotation_validity ?? 30,
      lockConfirmedSales: data?.lock_confirmed_sales !== false,
      enableSaleWarnings: data?.enable_sale_warnings !== false,
      enableProforma: data?.enable_proforma !== false,
      showMarginsByDefault: data?.show_margins_by_default === true || data?.raw?.showMarginsByDefault === true,
    }),
    [data, isLoading, refetch],
  )

  return <SalesSettingsContext.Provider value={value}>{children}</SalesSettingsContext.Provider>
}

export function useSalesSettings() {
  return useContext(SalesSettingsContext)
}

export default SalesSettingsContext
