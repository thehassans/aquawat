/**
 * Lightweight HTML sanitizer for CMS/email HTML rendered with dangerouslySetInnerHTML.
 * Strips scripts, event handlers, and javascript: URLs. Not a full DOMPurify replacement.
 */
export function sanitizeHtml(html) {
  if (!html) return '';
  let out = String(html);

  out = out.replace(/<\s*(script|iframe|object|embed|link|meta|base|form|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  out = out.replace(/<\s*(script|iframe|object|embed|link|meta|base|form|svg|math)[^>]*\/?\s*>/gi, '');
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/(href|src|xlink:href)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '$1=$2#$2');
  out = out.replace(/(href|src|xlink:href)\s*=\s*javascript:[^\s>]*/gi, '$1="#');
  out = out.replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '');
  out = out.replace(/\s(href|src)\s*=\s*(['"])\s*data:text\/html[^'"]*\2/gi, ' $1=$2#$2');

  return out;
}

export default sanitizeHtml;
