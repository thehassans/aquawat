/**
 * Open Salt Edge Connect in a new tab (redirect-based OAuth).
 */
export function openSaltEdgeConnect(authorizeUrl) {
  if (!authorizeUrl) throw new Error('authorizeUrl is required')
  if (typeof window === 'undefined') throw new Error('window unavailable')
  const win = window.open(authorizeUrl, '_blank', 'noopener,noreferrer')
  if (!win) throw new Error('Popup blocked — allow popups or open the authorize URL manually')
  return win
}

export default { openSaltEdgeConnect }
