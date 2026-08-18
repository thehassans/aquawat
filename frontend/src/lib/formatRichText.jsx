import React from 'react'

/**
 * Safely parses and renders text with Markdown-style bold (**text**)
 * and highlight (==text== or <mark>text</mark>) and bullet points.
 */
export function formatRichText(rawText) {
  if (!rawText) return null
  const text = String(rawText)

  // Split by newlines to preserve structure
  const lines = text.split('\n')

  return lines.map((line, lineIdx) => {
    // Check if line starts with bullet
    const isBullet = line.trim().startsWith('•') || line.trim().startsWith('- ') || line.trim().startsWith('* ')
    const cleanLine = isBullet ? line.replace(/^(\s*)[•\-\*]\s*/, '$1') : line

    // Regex to match **bold** or ==highlight== or <mark>highlight</mark> or <b>bold</b>
    const regex = /(\*\*[^*]+\*\*|==[^=]+==|<mark>[^<]+<\/mark>|<b>[^<]+<\/b>)/g
    const parts = cleanLine.split(regex)

    const renderedLine = parts.map((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const content = part.slice(2, -2)
        return (
          <strong key={partIdx} className="font-extrabold text-slate-950 dark:text-white underline decoration-slate-400 decoration-1 underline-offset-2">
            {content}
          </strong>
        )
      }
      if (part.startsWith('<b>') && part.endsWith('</b>')) {
        const content = part.slice(3, -4)
        return (
          <strong key={partIdx} className="font-extrabold text-slate-950 dark:text-white underline decoration-slate-400 decoration-1 underline-offset-2">
            {content}
          </strong>
        )
      }
      if (part.startsWith('==') && part.endsWith('==')) {
        const content = part.slice(2, -2)
        return (
          <mark
            key={partIdx}
            className="rounded bg-amber-200/90 px-1 py-0.5 font-bold text-amber-950 shadow-xs dark:bg-amber-400/30 dark:text-amber-100 dark:ring-1 dark:ring-amber-400/50"
          >
            {content}
          </mark>
        )
      }
      if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
        const content = part.slice(6, -7)
        return (
          <mark
            key={partIdx}
            className="rounded bg-amber-200/90 px-1 py-0.5 font-bold text-amber-950 shadow-xs dark:bg-amber-400/30 dark:text-amber-100 dark:ring-1 dark:ring-amber-400/50"
          >
            {content}
          </mark>
        )
      }
      return <React.Fragment key={partIdx}>{part}</React.Fragment>
    })

    return (
      <span key={lineIdx} className={isBullet ? 'flex items-start gap-1.5' : 'block'}>
        {isBullet && <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>}
        <span className="flex-1">{renderedLine}</span>
      </span>
    )
  })
}

/**
 * Strips formatting markup (** and == and <mark>) for plain-text outputs like PDF/TXT.
 */
export function stripRichMarkup(text) {
  if (!text) return ''
  return String(text)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/<mark>([^<]+)<\/mark>/g, '$1')
    .replace(/<b>([^<]+)<\/b>/g, '$1')
    .replace(/<\/?[^>]+(>|$)/g, '')
}
