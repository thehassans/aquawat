import { useCallback, useRef, useState } from 'react'
import ForceVariantPickModal from '../components/inventory/ForceVariantPickModal'
import { resolveOperationsLinePick } from './productVariantSearch'

/**
 * Resolve a catalog pick; if the template has multiple variants, open a modal
 * and only resolve after the user selects a concrete combination.
 */
export function useForceVariantPick({ ar = false, variantsEnabled = true } = {}) {
  const [pending, setPending] = useState(null)
  const waiters = useRef(null)

  const resolvePick = useCallback(async (opt) => {
    const resolved = await resolveOperationsLinePick(opt, { variantsEnabled })
    if (!resolved.needsVariant || resolved.variantId) return resolved

    return new Promise((resolve, reject) => {
      waiters.current = { resolve, reject }
      setPending({
        productId: resolved.productId,
        productName: resolved.productName,
        base: resolved,
      })
    })
  }, [variantsEnabled])

  const forceVariantModal = (
    <ForceVariantPickModal
      open={Boolean(pending)}
      productId={pending?.productId}
      productName={pending?.productName || ''}
      ar={ar}
      onClose={() => {
        const err = new Error('Variant selection cancelled')
        err.code = 'VARIANT_PICK_CANCELLED'
        waiters.current?.reject?.(err)
        waiters.current = null
        setPending(null)
      }}
      onConfirm={(pick) => {
        const merged = {
          ...(pending?.base || {}),
          ...pick,
          variants: [],
          needsVariant: false,
          productHasVariants: true,
        }
        waiters.current?.resolve?.(merged)
        waiters.current = null
        setPending(null)
      }}
    />
  )

  return { resolvePick, forceVariantModal }
}

export function isVariantPickCancelled(err) {
  return err?.code === 'VARIANT_PICK_CANCELLED'
}
