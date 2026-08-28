import { useCallback } from 'react'
import { List } from 'react-window'

const DEFAULT_ROW_HEIGHT = 56
const VIRTUALIZE_THRESHOLD = 50
const DEFAULT_HEIGHT = 520

/**
 * Virtualized scroll list for 50+ rows (react-window v2 API).
 * Renders normal children when under threshold.
 */
export default function VirtualScrollList({
  items = [],
  rowHeight = DEFAULT_ROW_HEIGHT,
  threshold = VIRTUALIZE_THRESHOLD,
  height = DEFAULT_HEIGHT,
  renderItem,
  getItemKey,
  className = '',
}) {
  const useVirtual = items.length > threshold

  const RowComponent = useCallback(
    ({ index, style, rows, renderRow, keyFn }) => {
      const item = rows[index]
      const key = keyFn ? keyFn(item, index) : index
      return (
        <div style={style} key={key}>
          {renderRow(item, index)}
        </div>
      )
    },
    [],
  )

  if (!useVirtual) {
    return (
      <div className={className}>
        {items.map((item, index) => (
          <div key={getItemKey ? getItemKey(item, index) : index}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    )
  }

  const listHeight = Math.min(height, Math.max(rowHeight * 4, items.length * rowHeight))

  return (
    <div className={className}>
      <List
        rowCount={items.length}
        rowHeight={rowHeight}
        defaultHeight={listHeight}
        style={{ height: listHeight, width: '100%' }}
        rowProps={{ rows: items, renderRow: renderItem, keyFn: getItemKey }}
        rowComponent={RowComponent}
        overscanCount={8}
      />
    </div>
  )
}

export { VIRTUALIZE_THRESHOLD, DEFAULT_ROW_HEIGHT, DEFAULT_HEIGHT }
