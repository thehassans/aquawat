/**
 * Renders mobile cards below md and the table (children) from md up.
 * Pass the same data array to both `items` + `renderCard` and table body.
 */
export default function ResponsiveDataList({
  items = [],
  renderCard,
  empty = null,
  className = '',
  children,
}) {
  const list = Array.isArray(items) ? items : []
  const hasItems = list.length > 0

  return (
    <div className={className}>
      <div className="md:hidden space-y-3">
        {!hasItems && empty}
        {hasItems && list.map((item, index) => renderCard(item, index))}
      </div>
      <div className="hidden md:block">{children}</div>
    </div>
  )
}
