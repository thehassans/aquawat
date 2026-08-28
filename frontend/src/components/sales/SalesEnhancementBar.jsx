import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import ApplyPromoPanel from './ApplyPromoPanel'
import ComputeShippingModal from './ComputeShippingModal'
import VariantMatrixModal from './VariantMatrixModal'
import { useSalesSettings } from '../../context/SalesSettingsContext'
import { fieldControlClass, fieldLabelClass, ghostActionClass, sectionCardClass } from '../../pages/sales/salesUi'
import { INCOTERMS } from '../../pages/sales/salesConfig.menu'

/**
 * Optional sales toolbar — visibility driven by Sales Settings.
 */
export default function SalesEnhancementBar({
  subtotal = 0,
  customerId,
  onApplyDiscountLine,
  onAddLines,
  onAddShippingLine,
  onIncotermChange,
  incoterm = '',
  showMatrix = false,
  variants = [],
}) {
  const {
    showIncotermOnDocuments,
    showComputeShipping,
    showPromoCodes,
    enableSaleWarnings,
    showCrmTagsOnDocuments,
  } = useSalesSettings()

  const [shippingOpen, setShippingOpen] = useState(false)
  const [matrixOpen, setMatrixOpen] = useState(false)

  const { data: tags } = useQuery({
    queryKey: ['sales-tags'],
    queryFn: async () => (await api.get('/sales/tags')).data.items || [],
    enabled: showCrmTagsOnDocuments,
  })

  const checkWarnings = async (productIds = []) => {
    if (!customerId && !productIds.length) return
    try {
      const { data } = await api.get('/sales/sale-warnings', {
        params: { customerId, productIds: productIds.join(',') },
      })
      if (data.hasBlock) {
        toast.error(data.blocks[0]?.message || 'Sale blocked')
        return false
      }
      if (data.warnings?.length) {
        toast(data.warnings[0].message, { icon: '⚠️' })
      }
      return true
    } catch {
      return true
    }
  }

  const showToolbar =
    showIncotermOnDocuments ||
    showComputeShipping ||
    enableSaleWarnings ||
    showMatrix

  if (!showToolbar && !showPromoCodes && !(showCrmTagsOnDocuments && (tags || []).length)) {
    return null
  }

  return (
    <div className="space-y-2">
      {showToolbar ? (
        <div className={`${sectionCardClass} !py-2.5 flex flex-wrap items-end gap-2`}>
          {showIncotermOnDocuments ? (
            <div className="min-w-[120px]">
              <label className={fieldLabelClass}>Incoterm</label>
              <select
                className={fieldControlClass}
                value={incoterm}
                onChange={(e) => onIncotermChange?.(e.target.value)}
              >
                <option value="">—</option>
                {INCOTERMS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          ) : null}

          {showMatrix ? (
            <button type="button" className={ghostActionClass} onClick={() => setMatrixOpen(true)}>
              Variant grid
            </button>
          ) : null}
          {showComputeShipping ? (
            <button type="button" className={ghostActionClass} onClick={() => setShippingOpen(true)}>
              Compute shipping
            </button>
          ) : null}
          {enableSaleWarnings ? (
            <button type="button" className={ghostActionClass} onClick={() => checkWarnings()}>
              Check sale warnings
            </button>
          ) : null}
        </div>
      ) : null}

      {showPromoCodes ? (
        <ApplyPromoPanel subtotal={subtotal} onApplyDiscountLine={onApplyDiscountLine} />
      ) : null}

      {showCrmTagsOnDocuments && (tags || []).length > 0 ? (
        <div className={`${sectionCardClass} !py-2 flex flex-wrap gap-2`}>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">CRM tags</span>
          {tags.map((tag) => (
            <span
              key={tag._id}
              className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
              style={{ backgroundColor: tag.colorHex || '#64748b' }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      ) : null}

      {showComputeShipping ? (
        <ComputeShippingModal
          open={shippingOpen}
          onClose={() => setShippingOpen(false)}
          orderPayload={{ customerId, subtotal }}
          onSelectRate={(rate) => {
            onAddShippingLine?.({
              productName: `Shipping: ${rate.provider} ${rate.serviceName}`,
              quantity: 1,
              unitPrice: rate.amount,
              productType: 'service',
            })
            toast.success(`Added ${rate.provider} rate`)
          }}
        />
      ) : null}

      <VariantMatrixModal
        open={matrixOpen}
        onClose={() => setMatrixOpen(false)}
        variants={variants}
        onAddLines={onAddLines}
      />
    </div>
  )
}
