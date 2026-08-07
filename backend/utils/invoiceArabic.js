import { translateWithFallback } from './aiService.js'
import { autoTranslateText } from './builtInTranslator.js'

const hasArabicText = (value = '') => /[\u0600-\u06FF]/.test(String(value || ''))
const hasTranslatableText = (value = '') => /[A-Za-z\u0600-\u06FF]/.test(String(value || '').trim())

// ── Global translation cache (persists across calls within same process) ────────
const GLOBAL_TRANSLATION_CACHE = new Map()
const MAX_CACHE_SIZE = 3000

const getCached = (key) => GLOBAL_TRANSLATION_CACHE.get(key)
const setCache = (key, value) => {
  if (GLOBAL_TRANSLATION_CACHE.size >= MAX_CACHE_SIZE) {
    const firstKey = GLOBAL_TRANSLATION_CACHE.keys().next().value
    GLOBAL_TRANSLATION_CACHE.delete(firstKey)
  }
  GLOBAL_TRANSLATION_CACHE.set(key, value)
}

// ── Batch translation engine with Built-in First ──────────────────────────────
const BATCH_SEPARATOR = '\n|||ITEM|||\n'

const batchTranslate = async (items, targetLanguage) => {
  if (items.length === 0) return {}

  const uncachedItems = []
  const result = {}

  // 1. Pull from cache OR built-in translator first
  for (const item of items) {
    const cacheKey = `${targetLanguage}:${item.text}`
    const cached = getCached(cacheKey)
    if (cached !== undefined) {
      result[item.id] = cached
      continue
    }

    // Built-in translator
    const builtIn = autoTranslateText(item.text, targetLanguage === 'en' ? 'ar' : 'en', targetLanguage)
    if (builtIn && builtIn !== item.text) {
      result[item.id] = builtIn
      setCache(cacheKey, builtIn)
      continue
    }

    uncachedItems.push(item)
  }

  if (uncachedItems.length === 0) return result

  // 2. Fallback to LLM only for uncached/unrecognized complex sentences
  try {
    const sourceLang = targetLanguage === 'en' ? 'Arabic' : 'English'
    const targetLangStr = targetLanguage === 'en' ? 'English' : 'Arabic'

    const combinedText = uncachedItems.map(item => item.text).join(BATCH_SEPARATOR)
    const prompt = `Translate each of the following texts from ${sourceLang} to ${targetLangStr}. Each text is separated by "|||ITEM|||". Return ONLY the translations in the exact same order, each separated by "|||ITEM|||". Do not add any commentary, explanations, or extra text. Transliterate proper names instead of translating.\n\nTexts:\n${combinedText}`

    const translated = await translateWithFallback({ text: prompt, targetLanguage, _batchMode: true })
    const parts = (translated || '').split(BATCH_SEPARATOR)

    uncachedItems.forEach((item, i) => {
      const translatedText = (parts[i] || '').trim()
      if (translatedText) {
        result[item.id] = translatedText
        setCache(`${targetLanguage}:${item.text}`, translatedText)
      } else {
        // Fallback to built-in transliteration
        const fallback = autoTranslateText(item.text, targetLanguage === 'en' ? 'ar' : 'en', targetLanguage)
        result[item.id] = fallback || item.text
      }
    })
  } catch (err) {
    console.warn('[invoiceArabic] Batch translation fallback to built-in:', err.message)
    uncachedItems.forEach(item => {
      const fallback = autoTranslateText(item.text, targetLanguage === 'en' ? 'ar' : 'en', targetLanguage)
      result[item.id] = fallback || item.text
    })
  }

  return result
}

export const enrichInvoiceArabicFields = async (invoiceData = {}) => {
  const next = JSON.parse(JSON.stringify(invoiceData || {}))

  // Collect all fields that need translation, grouped by target language
  const toEnQueue = []

  const queueBilingual = (holder, primaryKey, arabicKey) => {
    if (!holder) return
    const primaryValue = String(holder[primaryKey] || '').trim()
    const arabicValue = String(holder[arabicKey] || '').trim()

    if (primaryValue && hasArabicText(primaryValue)) {
      if (!arabicValue) holder[arabicKey] = primaryValue
      if (!hasTranslatableText(primaryValue)) return
      toEnQueue.push({
        id: `${primaryKey}_${toEnQueue.length}`,
        text: primaryValue,
        targetLanguage: 'en',
        apply: (t) => {
          if (t && (!holder[primaryKey] || hasArabicText(holder[primaryKey]))) holder[primaryKey] = t
        }
      })
    } else if (primaryValue && !arabicValue) {
      if (!hasTranslatableText(primaryValue)) return
      toEnQueue.push({
        id: `${primaryKey}_ar_${toEnQueue.length}`,
        text: primaryValue,
        targetLanguage: 'ar',
        apply: (t) => { if (t && !holder[arabicKey]) holder[arabicKey] = t }
      })
    } else if (!primaryValue && arabicValue) {
      if (!hasTranslatableText(arabicValue)) return
      toEnQueue.push({
        id: `${primaryKey}_en_${toEnQueue.length}`,
        text: arabicValue,
        targetLanguage: 'en',
        apply: (t) => { if (t && !holder[primaryKey]) holder[primaryKey] = t }
      })
    }
  }

  // Queue all fields
  queueBilingual(next?.buyer, 'name', 'nameAr')
  queueBilingual(next?.seller, 'name', 'nameAr')

  for (const lineItem of Array.isArray(next?.lineItems) ? next.lineItems : []) {
    queueBilingual(lineItem, 'productName', 'productNameAr')
    queueBilingual(lineItem, 'description', 'descriptionAr')
  }

  if (next?.travelDetails) {
    queueBilingual(next.travelDetails, 'travelerName', 'travelerNameAr')
    queueBilingual(next.travelDetails, 'airlineName', 'airlineNameAr')
    queueBilingual(next.travelDetails, 'routeFrom', 'routeFromAr')
    queueBilingual(next.travelDetails, 'routeTo', 'routeToAr')
    queueBilingual(next.travelDetails, 'layoverStay', 'layoverStayAr')

    for (const segment of Array.isArray(next.travelDetails?.segments) ? next.travelDetails.segments : []) {
      queueBilingual(segment, 'from', 'fromAr')
      queueBilingual(segment, 'to', 'toAr')
    }
    for (const passenger of Array.isArray(next.travelDetails?.passengers) ? next.travelDetails?.passengers : []) {
      queueBilingual(passenger, 'name', 'nameAr')
    }
  }

  if (toEnQueue.length === 0) return next

  // Split into two batches by direction (en→ar and ar→en)
  const toAr = toEnQueue.filter(i => i.targetLanguage === 'ar')
  const toEn = toEnQueue.filter(i => i.targetLanguage === 'en')

  const timeout = (ms) => new Promise(r => setTimeout(r, ms))

  const [arResults, enResults] = await Promise.allSettled([
    toAr.length > 0
      ? Promise.race([batchTranslate(toAr, 'ar'), timeout(3000).then(() => ({}))])
      : Promise.resolve({}),
    toEn.length > 0
      ? Promise.race([batchTranslate(toEn, 'en'), timeout(3000).then(() => ({}))])
      : Promise.resolve({}),
  ])

  const arMap = arResults.status === 'fulfilled' ? arResults.value : {}
  const enMap = enResults.status === 'fulfilled' ? enResults.value : {}

  // Apply results back to holders
  for (const item of toAr) {
    if (arMap[item.id]) item.apply(arMap[item.id])
  }
  for (const item of toEn) {
    if (enMap[item.id]) item.apply(enMap[item.id])
  }

  return next
}

export default enrichInvoiceArabicFields
