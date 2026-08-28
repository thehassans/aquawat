import { useCallback } from 'react'
import { List } from 'react-window'

const DEFAULT_ROW_HEIGHT = 72
const VIRTUALIZE_THRESHOLD = 50
const DEFAULT_HEIGHT = 560

/**
 * Virtualized tbody rows for HTML tables with 50+ rows.
 * Falls back to a normal map when under the threshold.
 */
export default function VirtualTableBody({
  rows = [],
  rowHeight = DEFAULT_ROW_HEIGHT,
  threshold = VIRTUALIZE_THRESHOLD,
  height = DEFAULT_HEIGHT,
  renderRow,
  getRowKey,
}) {
  const useVirtual = rows.length > threshold

  const RowComponent = useCallback(
    ({ index, style, dataRows, renderTr, keyFn }) => {
      const row = dataRows[index]
      const key = keyFn ? keyFn(row, index) : index
      return (
        <div style={{ ...style, display: 'table', width: '100%', tableLayout: 'fixed' }} role="row">
          <div style={{ display: 'table-row' }}>{renderTr(row, index, key)}</div>
        </div>
      )
    },
    [],
  )

  if (!useVirtual) {
    return rows.map((row, index) => renderRow(row, index, getRowKey ? getRowKey(row, index) : index))
  }

  const listHeight = Math.min(height, Math.max(rowHeight * 4, rows.length * rowHeight))

  return (
    <tr aria-hidden="true">
      <td colSpan={99} className="p-0 border-0">
        <List
          rowCount={rows.length}
          rowHeight={rowHeight}
          defaultHeight={listHeight}
          style={{ height: listHeight, width: '100%' }}
          rowProps={{ dataRows: rows, renderTr: renderRow, keyFn: getRowKey }}
          rowComponent={RowComponent}
          overscanCount={8}
        />
      </td>
    </tr>
  )
}

export { VIRTUALIZE_THRESHOLD, DEFAULT_ROW_HEIGHT }
