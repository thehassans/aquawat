import { useEffect, useMemo, useRef, useState } from 'react'
import { useWatch } from 'react-hook-form'
import { autoTranslateText } from './builtInTranslator'

const translationCache = new Map()

export const useLiveTranslation = ({
  control,
  watch,
  setValue,
  sourceField,
  targetField,
  sourceLang,
  targetLang,
  enabled = true,
  debounceMs = 120, // Instant built-in debounce
  minLength = 2,
  initialTargetValue = '',
}) => {
  const [isTranslating, setIsTranslating] = useState(false)
  const timerRef = useRef(null)
  const lastAutoSourceRef = useRef('')
  const lastAutoResultRef = useRef(String(initialTargetValue || '').trim())

  const watchedSource = useWatch({ control, name: sourceField })
  const watchedTarget = useWatch({ control, name: targetField })
  const source = control ? watchedSource : (watch ? watch(sourceField) : '')
  const target = control ? watchedTarget : (watch ? watch(targetField) : '')
  const cacheKey = useMemo(() => `${sourceLang}:${targetLang}:${String(source || '').trim()}`, [source, sourceLang, targetLang])

  useEffect(() => {
    if (!enabled) return

    const s = String(source || '').trim()
    const t = String(target || '').trim()
    const cachedTranslation = translationCache.get(cacheKey)

    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (!s) {
      // Source was cleared (e.g. user backspaced the whole name). If the
      // target still holds exactly what we auto-translated into it, clear it
      // too so both language fields empty out together. If the user typed
      // the target independently, leave it alone.
      if (t && t === String(lastAutoResultRef.current || '').trim()) {
        lastAutoSourceRef.current = ''
        lastAutoResultRef.current = ''
        setValue(targetField, '', { shouldDirty: true, shouldValidate: false, shouldTouch: false })
      }
      return
    }

    if (s.length < minLength) return

    if (s === String(lastAutoSourceRef.current || '').trim() && t === String(lastAutoResultRef.current || '').trim()) {
      return
    }

    if (t && t !== String(lastAutoResultRef.current || '').trim()) {
      return
    }

    if (cachedTranslation) {
      lastAutoSourceRef.current = s
      lastAutoResultRef.current = cachedTranslation
      if (t !== cachedTranslation) {
        setValue(targetField, cachedTranslation, { shouldDirty: true, shouldValidate: false, shouldTouch: false })
      }
      return
    }

    timerRef.current = setTimeout(() => {
      try {
        setIsTranslating(true)
        // Perform instant built-in translation
        const translated = autoTranslateText(s, sourceLang, targetLang)

        if (translated) {
          lastAutoSourceRef.current = s
          lastAutoResultRef.current = translated
          translationCache.set(cacheKey, translated)
          setValue(targetField, translated, { shouldDirty: true, shouldValidate: false, shouldTouch: false })
        }
      } catch (err) {
        console.warn('[useLiveTranslation] Translation error:', err)
      } finally {
        setIsTranslating(false)
      }
    }, debounceMs)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [cacheKey, debounceMs, enabled, minLength, setValue, source, sourceField, target, targetField, sourceLang, targetLang])

  return { isTranslating }
}

export default useLiveTranslation

export function LineItemTranslator({ index, control, watch, setValue, enabled = true, initialNameAr = '', initialName = '' }) {
  useLiveTranslation({
    control, watch, setValue,
    sourceField: `lineItems.${index}.productName`,
    targetField: `lineItems.${index}.productNameAr`,
    sourceLang: 'en', targetLang: 'ar', enabled,
    initialTargetValue: initialNameAr,
  })
  useLiveTranslation({
    control, watch, setValue,
    sourceField: `lineItems.${index}.productNameAr`,
    targetField: `lineItems.${index}.productName`,
    sourceLang: 'ar', targetLang: 'en', enabled,
    initialTargetValue: initialName,
  })
  useLiveTranslation({
    control, watch, setValue,
    sourceField: `lineItems.${index}.description`,
    targetField: `lineItems.${index}.descriptionAr`,
    sourceLang: 'en', targetLang: 'ar', enabled,
  })
  useLiveTranslation({
    control, watch, setValue,
    sourceField: `lineItems.${index}.descriptionAr`,
    targetField: `lineItems.${index}.description`,
    sourceLang: 'ar', targetLang: 'en', enabled,
  })
  return null
}
