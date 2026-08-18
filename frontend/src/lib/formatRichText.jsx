import React from 'react'
import { sanitizeHtml } from './sanitizeHtml'

/**
 * Safely converts Markdown markers to clean HTML:
 * - **bold** -> <strong>bold</strong>
 * - ==highlight== -> <mark class="bg-amber-200 text-amber-950 font-semibold px-1 py-0.5 rounded">highlight</mark>
 */
export function convertMarkdownToHtml(raw) {
  if (!raw) return ''
  let html = String(raw)

  // Convert **text** to <strong>text</strong>
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  // Convert ==text== or <mark>text</mark> to styled mark
  html = html.replace(
    /==([^=]+)==/g,
    '<mark class="bg-amber-200 text-amber-950 font-bold px-1 py-0.5 rounded">$1</mark>'
  )

  return html
}

/**
 * Renders rich text safely. Handles both HTML from WYSIWYG editor
 * and legacy markdown/plain text with line breaks.
 */
export function formatRichText(rawText) {
  if (!rawText) return null
  const text = String(rawText).trim()
  if (!text) return null

  // Check if content already contains HTML tags or markdown tags
  const hasHtml = /<[a-z][\s\S]*>/i.test(text)
  const hasMarkdown = /\*\*|==/.test(text)

  if (hasHtml || hasMarkdown) {
    const htmlWithConvertedMarkdown = convertMarkdownToHtml(text)
    const cleanHtml = sanitizeHtml(htmlWithConvertedMarkdown)

    return (
      <div
        className="rich-text-content leading-relaxed space-y-1 text-slate-800 dark:text-slate-200 [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5 [&_li]:mt-0.5 [&_strong]:font-extrabold [&_strong]:text-slate-950 dark:[&_strong]:text-white [&_mark]:bg-amber-200/90 [&_mark]:text-amber-950 [&_mark]:font-bold [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:rounded dark:[&_mark]:bg-amber-400/30 dark:[&_mark]:text-amber-100"
        dangerouslySetInnerHTML={{ __html: cleanHtml }}
      />
    )
  }

  // Plain text: preserve newlines
  return (
    <div className="whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200">
      {text}
    </div>
  )
}

/**
 * Strips all HTML and markdown markup for plain-text outputs like PDF/TXT.
 * Converts block tags and list items to clean newlines.
 */
export function stripRichMarkup(raw) {
  if (!raw) return ''
  let text = String(raw)

  // Replace <br>, </p>, </div>, </tr> with newline
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n')
  text = text.replace(/<\/div>/gi, '\n')
  text = text.replace(/<\/tr>/gi, '\n')
  text = text.replace(/<li>/gi, '• ')
  text = text.replace(/<\/li>/gi, '\n')

  // Strip Markdown
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/==([^=]+)==/g, '$1')

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  // Collapse 3+ newlines into 2
  text = text.replace(/\n{3,}/g, '\n\n')

  return text.trim()
}
