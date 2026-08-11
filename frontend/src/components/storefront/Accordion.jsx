import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { sanitizeHtml } from '../../lib/sanitizeHtml';

export default function Accordion({ items, colors, isRTL }) {
  const [openIdx, setOpenIdx] = useState(0);

  const c = (key, fallback) => (colors && colors[key]) || fallback;

  if (!items || items.length === 0) return null;

  return (
    <div style={{ borderTop: `1px solid ${c('borderColor', '#e5e7eb')}`, marginTop: '40px' }}>
      {items.map((item, i) => {
        const isOpen = openIdx === i;
        const hasContent = item.content && item.content.trim();
        if (!hasContent) return null;
        return (
          <div key={i} style={{ borderBottom: `1px solid ${c('borderColor', '#e5e7eb')}` }}>
            <button
              onClick={() => setOpenIdx(isOpen ? -1 : i)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '18px 0', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '15px', fontWeight: 700, color: c('text', '#111'),
                transition: 'color 0.2s', textAlign: isRTL ? 'right' : 'left',
              }}
              onMouseEnter={e => e.currentTarget.style.color = c('primary', '#4f46e5')}
              onMouseLeave={e => e.currentTarget.style.color = c('text', '#111')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {item.icon && <item.icon size={18} style={{ color: c('textMuted', '#9ca3af') }} />}
                {item.title}
              </span>
              <ChevronDown
                size={20}
                style={{
                  color: c('textMuted', '#9ca3af'),
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease',
                  flexShrink: 0,
                }}
              />
            </button>
            <div style={{
              maxHeight: isOpen ? '500px' : '0',
              overflow: 'hidden',
              transition: 'max-height 0.3s ease, opacity 0.3s ease',
              opacity: isOpen ? 1 : 0,
            }}>
              <div style={{ padding: '0 0 20px', fontSize: '14px', color: c('textMuted', '#6b7280'), lineHeight: 1.8 }}>
                {item.raw ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.content) }} /> : <div>{item.content}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
