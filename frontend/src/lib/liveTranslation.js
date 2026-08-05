import { useEffect, useMemo, useRef, useState } from 'react'
import { useWatch } from 'react-hook-form'
import api from './api'

const translationCache = new Map()

const normalizeLang = (lang) => {
  const l = String(lang || '').toLowerCase()
  if (l === 'ar') return 'Arabic'
  if (l === 'en') return 'English'
  return lang || 'English'
}

export const useLiveTranslation = ({
  control,
  watch,
  setValue,
  sourceField,
  targetField,
  sourceLang,
  targetLang,
  enabled = true,
  debounceMs = 900,
  minLength = 3,
}) => {
  const [isTranslating, setIsTranslating] = useState(false)
  const timerRef = useRef(null)
  const lastAutoSourceRef = useRef('')
  const lastAutoResultRef = useRef('')
  const requestSequenceRef = useRef(0)
  const initialized = useRef(false)

  const watchedSource = useWatch({ control, name: sourceField })
  const watchedTarget = useWatch({ control, name: targetField })
  const source = control ? watchedSource : watch(sourceField)
  const target = control ? watchedTarget : watch(targetField)
  const cacheKey = useMemo(() => `${sourceLang}:${targetLang}:${String(source || '').trim()}`, [source, sourceLang, targetLang])

  useEffect(() => {
    if (!enabled) return

    const s = String(source || '').trim()
    const t = String(target || '').trim()
    const cachedTranslation = translationCache.get(cacheKey)
    
    if (!initialized.current) {
       lastAutoSourceRef.current = s
       lastAutoResultRef.current = t
       initialized.current = true
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (!s || s.length < minLength) return

    if (s === String(lastAutoSourceRef.current || '').trim() && t === String(lastAutoResultRef.current || '').trim()) {
      return
    }

    // If target changed but source didn't, the user is manually editing target. Don't overwrite it later.
    if (s === String(lastAutoSourceRef.current || '').trim() && t !== String(lastAutoResultRef.current || '').trim()) {
       lastAutoResultRef.current = t
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

    timerRef.current = setTimeout(async () => {
      const nextRequest = requestSequenceRef.current + 1
      requestSequenceRef.current = nextRequest

      try {
        setIsTranslating(true)
        const { data } = await api.post('/ai/translate', {
          text: s,
          sourceLang: normalizeLang(sourceLang),
          targetLang: normalizeLang(targetLang),
        })

        const translated = String(data?.translatedText || '').trim()
        if (!translated) return
        if (requestSequenceRef.current !== nextRequest) return

        lastAutoSourceRef.current = s
        lastAutoResultRef.current = translated
        translationCache.set(cacheKey, translated)
        setValue(targetField, translated, { shouldDirty: true, shouldValidate: false, shouldTouch: false })
      } catch (_) {
      } finally {
        if (requestSequenceRef.current === nextRequest) {
          setIsTranslating(false)
        }
      }
    }, debounceMs)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [cacheKey, debounceMs, enabled, minLength, setValue, source, sourceField, target, targetField])

  return { isTranslating }
}

export default useLiveTranslation

export function LineItemTranslator({ index, control, watch, setValue, enabled = true }) {
  useLiveTranslation({
    control, watch, setValue,
    sourceField: `lineItems.${index}.productName`,
    targetField: `lineItems.${index}.productNameAr`,
    sourceLang: 'en', targetLang: 'ar', enabled,
  })
  useLiveTranslation({
    control, watch, setValue,
    sourceField: `lineItems.${index}.productNameAr`,
    targetField: `lineItems.${index}.productName`,
    sourceLang: 'ar', targetLang: 'en', enabled,
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
