/** Build parent→children tree from flat InvLocation rows (parentId relational). */
export function buildLocationForest(flat = []) {
  const byId = new Map()
  for (const loc of flat) {
    byId.set(String(loc._id), { ...loc, children: [] })
  }
  const roots = []
  for (const node of byId.values()) {
    const pid = node.parentId?._id || node.parentId
    const parent = pid ? byId.get(String(pid)) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sortRec = (nodes) => {
    nodes.sort((a, b) => String(a.name || a.completePath || '').localeCompare(String(b.name || b.completePath || '')))
    for (const n of nodes) sortRec(n.children)
  }
  sortRec(roots)
  return roots
}

/** Flatten forest for display given expanded Set of ids. */
export function flattenLocationTree(roots, expanded) {
  const out = []
  const walk = (nodes, depth) => {
    for (const n of nodes) {
      const id = String(n._id)
      const hasChildren = Array.isArray(n.children) && n.children.length > 0
      out.push({
        ...n,
        depth,
        hasChildren,
        expanded: hasChildren && expanded.has(id),
      })
      if (hasChildren && expanded.has(id)) walk(n.children, depth + 1)
    }
  }
  walk(roots, 0)
  return out
}

/** Collect all descendant ids including self. */
export function collectSubtreeIds(node) {
  const ids = [String(node._id)]
  for (const c of node.children || []) ids.push(...collectSubtreeIds(c))
  return ids
}
