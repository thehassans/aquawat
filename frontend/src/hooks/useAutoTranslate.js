import { useState, useCallback } from 'react';
import { autoTranslateText } from '../lib/builtInTranslator';

/**
 * Built-in lightweight auto-translator hook for English <-> Arabic.
 * Operates with 0 latency directly in browser without AI API dependency or rate limits.
 */
export function useAutoTranslate() {
  const [isTranslating, setIsTranslating] = useState(false);

  const translate = useCallback((text, fromLang, toLang) => {
    if (!text || !text.trim()) return '';

    try {
      const result = autoTranslateText(text.trim(), fromLang, toLang);
      return result || '';
    } catch (error) {
      console.warn('[useAutoTranslate] Translation failed:', error);
      return '';
    }
  }, []);

  return { translate, isTranslating };
}

export default useAutoTranslate;
