/**
 * Load Plaid Link and open the modal with a link_token.
 * Resolves with { publicToken, metadata } or rejects on exit/error.
 */
export function loadPlaidLinkScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('window unavailable'))
  if (window.Plaid?.create) return Promise.resolve(window.Plaid)

  const existing = document.querySelector('script[data-maqder-plaid-link]')
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(window.Plaid))
      existing.addEventListener('error', () => reject(new Error('Failed to load Plaid Link')))
      if (window.Plaid?.create) resolve(window.Plaid)
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
    script.async = true
    script.dataset.maqderPlaidLink = '1'
    script.onload = () => {
      if (window.Plaid?.create) resolve(window.Plaid)
      else reject(new Error('Plaid Link loaded without Plaid global'))
    }
    script.onerror = () => reject(new Error('Failed to load Plaid Link'))
    document.head.appendChild(script)
  })
}

export async function openPlaidLink(linkToken) {
  if (!linkToken) throw new Error('linkToken is required')
  const Plaid = await loadPlaidLinkScript()

  return new Promise((resolve, reject) => {
    let settled = false
    const handler = Plaid.create({
      token: linkToken,
      onSuccess: (publicToken, metadata) => {
        settled = true
        try { handler.exit({ force: true }) } catch { /* ignore */ }
        resolve({ publicToken, metadata })
      },
      onExit: (error) => {
        if (settled) return
        if (error) reject(new Error(error.display_message || error.error_message || 'Plaid Link exited'))
        else reject(new Error('Plaid Link closed'))
      },
      onEvent: () => {},
    })
    handler.open()
  })
}

export default { loadPlaidLinkScript, openPlaidLink }
