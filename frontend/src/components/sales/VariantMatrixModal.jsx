import { useMemo, useState } from 'react'
import { sectionCardClass, fieldControlClass, fieldLabelClass } from '../../pages/sales/salesUi'

/**
 * Variant matrix modal — X/Y attribute grid for bulk line entry.
 * Parent receives [{ variantId, productId, productName, quantity, unitPrice }]
 */
export default function VariantMatrixModal({ open, onClose, variants = [], xLabel = 'Size', yLabel = 'Color', onApply }) {
  const [qtyMap, setQtyMap] = useState({})

  const { xValues, yValues, grid } = useMemo(() => {
    const xs = [...new Set(variants.map((v) => v.x || v.size || '—'))]
    const ys = [...new Set(variants.map((v) => v.y || v.color || '—'))]
    const map = new Map()
    for (const v of variants) {
      const x = v.x || v.size || '—'
      const y = v.y || v.color || '—'
      map.set(`${x}|${y}`, v)
    }
    return { xValues: xs, yValues: ys, grid: map }
  }, [variants])

  if (!open) return null

  const apply = () => {
    const lines = []
    for (const [key, qty] of Object.entries(qtyMap)) {
      const n = Number(qty)
      if (!n || n <= 0) continue
      const [x, y] = key.split('|')
      const v = grid.get(`${x}|${y}`)
      if (!v) continue
      lines.push({
        variantId: v._id || v.variantId,
        productId: v.productId,
        productName: v.name || v.productName,
        quantity: n,
        unitPrice: v.price || v.unitPrice || 0,
      })
    }
    onApply?.(lines)
    setQtyMap({})
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`${sectionCardClass} max-h-[90vh] w-full max-w-4xl overflow-auto`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Variant grid entry</h3>
          <button type="button" className="text-sm text-slate-500" onClick={onClose}>Close</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left text-xs uppercase text-slate-500">{yLabel} \ {xLabel}</th>
                {xValues.map((x) => (
                  <th key={x} className="px-2 py-2 text-center text-xs font-semibold text-slate-600">{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yValues.map((y) => (
                <tr key={y}>
                  <td className="px-2 py-2 font-medium text-slate-700">{y}</td>
                  {xValues.map((x) => {
                    const key = `${x}|${y}`
                    const cell = grid.get(key)
                    return (
                      <td key={key} className="px-2 py-2">
                        {cell ? (
                          <input
                            type="number"
                            min={0}
                            className={`${fieldControlClass} w-20 text-center`}
                            value={qtyMap[key] ?? ''}
                            onChange={(e) => setQtyMap((p) => ({ ...p, [key]: e.target.value }))}
                          />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={apply}>Add lines</button>
        </div>
      </div>
    </div>
  )
}
