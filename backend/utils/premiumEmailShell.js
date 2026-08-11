/**
 * Shared ultra-premium, minimal HTML email shell for Maqder tenant mail.
 * Email clients strip most CSS animation — keep markup static and restrained.
 */

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

export const getTenantSlug = (tenantOrSlug) => {
  if (!tenantOrSlug) return ''
  if (typeof tenantOrSlug === 'string') return String(tenantOrSlug).trim().toLowerCase()
  return String(tenantOrSlug.slug || '').trim().toLowerCase()
}

/** Dedicated tenant workspace login: https://{slug}.maqder.com/login */
export const getTenantLoginUrl = (tenantOrSlug) => {
  const slug = getTenantSlug(tenantOrSlug)
  if (!slug) return 'https://maqder.com/login'
  return `https://${slug}.maqder.com/login`
}

export const getTenantWorkspaceHost = (tenantOrSlug) => {
  const slug = getTenantSlug(tenantOrSlug)
  if (!slug) return 'maqder.com'
  return `${slug}.maqder.com`
}

export const getTenantWorkspaceUrl = (tenantOrSlug) => {
  const slug = getTenantSlug(tenantOrSlug)
  if (!slug) return 'https://maqder.com'
  return `https://${slug}.maqder.com`
}

const DEFAULT_LOGO = 'https://maqder.com/maqderpwa.png'

const buildSecondaryHtml = (secondaryLines = []) => {
  const rows = (Array.isArray(secondaryLines) ? secondaryLines : [])
    .map((line) => {
      if (!line) return null
      if (typeof line === 'string') {
        const text = String(line).trim()
        if (!text) return null
        const sep = text.indexOf(':')
        if (sep > 0 && sep < 40) {
          return { label: text.slice(0, sep).trim(), value: text.slice(sep + 1).trim() }
        }
        return { label: '', value: text }
      }
      const label = String(line.label || '').trim()
      const value = String(line.value || '').trim()
      if (!value) return null
      return { label, value, href: line.href || '' }
    })
    .filter(Boolean)

  if (!rows.length) return ''

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;border-collapse:collapse;">
    ${rows.map((row, index) => `
      <tr>
        <td style="padding:${index === 0 ? '0' : '14px'} 0 14px;border-top:${index === 0 ? '0' : '1px solid #eceff3'};vertical-align:top;">
          ${row.label ? `<div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin:0 0 4px;">${escapeHtml(row.label)}</div>` : ''}
          <div style="font-size:15px;font-weight:600;color:#0f172a;line-height:1.5;word-break:break-word;">
            ${row.href
              ? `<a href="${escapeHtml(row.href)}" style="color:#0f766e;text-decoration:none;">${escapeHtml(row.value)}</a>`
              : escapeHtml(row.value)}
          </div>
        </td>
      </tr>`).join('')}
  </table>`
}

/**
 * Ultra-premium minimal shell — brand strip, one title, body, optional meta, one CTA.
 */
export const buildPremiumEmailShell = ({
  brandName = 'Maqder',
  title = '',
  body = '',
  htmlBody = '',
  secondaryLines = [],
  dir = 'ltr',
  cta = null,
  workspaceUrl = '',
  workspaceHost = '',
  logoUrl = DEFAULT_LOGO,
  department = '',
} = {}) => {
  const contentHtml = htmlBody || escapeHtml(body || '').replace(/\r?\n/g, '<br />')
  const secondaryHtml = buildSecondaryHtml(secondaryLines)
  const footerHost = String(workspaceHost || '').trim()
    || (workspaceUrl ? String(workspaceUrl).replace(/^https?:\/\//, '').replace(/\/.*$/, '') : '')
    || 'maqder.com'
  const footerHref = String(workspaceUrl || '').trim() || `https://${footerHost}`

  const ctaHtml = cta?.href
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px 0 0;">
        <tr>
          <td style="background:#0f766e;border-radius:10px;">
            <a href="${escapeHtml(cta.href)}" style="display:inline-block;padding:13px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
              ${escapeHtml(cta.label || 'Open workspace')}
            </a>
          </td>
        </tr>
      </table>`
    : ''

  const deptHtml = department
    ? `<div style="margin:0 0 10px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#0f766e;">${escapeHtml(department)}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(title)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="height:3px;background:#0f766e;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:36px 40px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" valign="middle">
                    ${deptHtml}
                    <div style="font-size:12px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;">${escapeHtml(brandName)}</div>
                  </td>
                  <td align="right" valign="middle" width="48">
                    <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brandName)}" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:10px;object-fit:cover;" />
                  </td>
                </tr>
              </table>
              <h1 style="margin:20px 0 0;font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:#0f172a;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 36px;">
              <div style="font-size:15px;line-height:1.75;color:#334155;">${contentHtml}</div>
              ${secondaryHtml}
              ${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #f1f5f9;background:#fafafa;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;">
                ${escapeHtml(brandName)}
                <span style="color:#cbd5e1;"> · </span>
                <a href="${escapeHtml(footerHref)}" style="color:#0f766e;text-decoration:none;font-weight:600;">${escapeHtml(footerHost)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export const buildPremiumBilingualEmailShell = ({
  brandName = 'Maqder',
  title = '',
  sections = [],
  workspaceUrl = '',
  workspaceHost = '',
  logoUrl = DEFAULT_LOGO,
  cta = null,
} = {}) => {
  const sectionsHtml = (Array.isArray(sections) ? sections : [])
    .filter((section) => section?.body || section?.htmlBody)
    .map((section, index) => {
      const dir = section.dir === 'rtl' ? 'rtl' : 'ltr'
      const align = dir === 'rtl' ? 'right' : 'left'
      const bodyHtml = section.htmlBody
        || escapeHtml(section.body || '').replace(/\r?\n/g, '<br />')
      const secondaryHtml = buildSecondaryHtml(section.secondaryLines || [])
      return `<section dir="${dir}" style="padding:${index === 0 ? '0' : '28px'} 0 0;text-align:${align};${dir === 'rtl' ? 'font-family:Tahoma,Arial,sans-serif;' : ''}">
        ${index > 0 ? '<div style="height:1px;background:#eceff3;margin:0 0 28px;"></div>' : ''}
        ${section.title ? `<h2 style="margin:0 0 12px;font-size:18px;line-height:1.4;font-weight:700;color:#0f172a;">${escapeHtml(section.title)}</h2>` : ''}
        <div style="font-size:15px;line-height:1.75;color:#334155;">${bodyHtml}</div>
        ${secondaryHtml}
      </section>`
    })
    .join('')

  return buildPremiumEmailShell({
    brandName,
    title,
    htmlBody: sectionsHtml,
    workspaceUrl,
    workspaceHost,
    logoUrl,
    cta,
    dir: 'ltr',
  })
}

export { escapeHtml }
