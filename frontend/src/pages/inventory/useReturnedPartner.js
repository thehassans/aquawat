import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../lib/api'

/**
 * After Advanced Create returns with ?partnerId=, fetch and select the contact,
 * then strip the query param so refresh does not re-apply.
 */
export function useReturnedPartner({ role = 'customer', setValue, setSelected, showPartner }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const partnerId = searchParams.get('partnerId')

  useEffect(() => {
    if (!partnerId) return undefined

    let cancelled = false
    ;(async () => {
      try {
        let opt
        if (role === 'vendor') {
          const s = await api.get(`/suppliers/${partnerId}`).then((r) => r.data)
          opt = { ...s, name: s.nameEn || s.name || s.nameAr || '—' }
        } else {
          opt = await api.get(`/customers/${partnerId}`).then((r) => r.data)
        }
        if (cancelled || !opt?._id) return
        setValue?.('partnerId', opt._id, { shouldDirty: true, shouldValidate: true })
        setSelected?.(opt)
        showPartner?.(true)
      } catch {
        /* ignore — user can re-pick */
      } finally {
        if (cancelled) return
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.delete('partnerId')
          return next
        }, { replace: true })
      }
    })()

    return () => { cancelled = true }
  }, [partnerId, role, setValue, setSelected, showPartner, setSearchParams])
}
