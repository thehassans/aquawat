import { formatZatcaQrTimestamp } from './zatcaTimestamp'

const encoder = new TextEncoder()

const toNumber = (value, fallback = 0) => {
  const numericValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

const encodeTlvField = (tag, value) => {
  const buffer = encoder.encode(String(value || ''))
  if (buffer.length > 255) {
    throw new Error(`ZATCA QR field ${tag} exceeds 255 bytes (${buffer.length})`)
  }
  return [tag, buffer.length, ...buffer]
}

const bytesToBase64 = (bytes) => {
  const chunkSize = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk)
  }
  return btoa(binary)
}

const VAT_NUMBER_REGEX = /^3[0-9]{13}3$/

export const validateZatcaQrFields = ({ sellerName, vatNumber, totalWithVat, vatTotal }) => {
  const errors = []

  if (!sellerName || String(sellerName).trim().length === 0) {
    errors.push('Seller name is required')
  }
  if (!vatNumber || !VAT_NUMBER_REGEX.test(String(vatNumber).trim())) {
    errors.push('VAT number must be 15 digits starting and ending with 3')
  }
  const total = toNumber(totalWithVat, null)
  if (total === null || total < 0) {
    errors.push('Total with VAT must be a non-negative number')
  }
  const vat = toNumber(vatTotal, null)
  if (vat === null || vat < 0) {
    errors.push('VAT total must be a non-negative number')
  }
  if (total !== null && vat !== null && vat > total) {
    errors.push('VAT total cannot exceed invoice total')
  }

  return { valid: errors.length === 0, errors }
}

export const generateZatcaQrValue = ({ sellerName, vatNumber, timestamp, issueTime, totalWithVat, vatTotal }) => {
  try {
    const validation = validateZatcaQrFields({ sellerName, vatNumber, totalWithVat, vatTotal })
    if (!validation.valid) {
      // Return null instead of throwing so callers can hide the QR gracefully
      // (e.g. when the VAT number hasn't been configured yet).
      console.warn('[ZATCA QR] Cannot generate QR:', validation.errors.join(', '))
      return null
    }

    const isoTimestamp = formatZatcaQrTimestamp(timestamp || new Date(), issueTime)

    const fields = [
      encodeTlvField(1, sellerName || ''),
      encodeTlvField(2, vatNumber || ''),
      encodeTlvField(3, isoTimestamp),
      encodeTlvField(4, toNumber(totalWithVat).toFixed(2)),
      encodeTlvField(5, toNumber(vatTotal).toFixed(2)),
    ]

    return bytesToBase64(fields.flat())
  } catch (error) {
    console.error('[ZATCA QR] Generation failed:', error.message)
    return null
  }
}

export const decodeZatcaQrValue = (base64) => {
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }

    const tagNames = {
      1: 'sellerName',
      2: 'vatNumber',
      3: 'timestamp',
      4: 'totalWithVat',
      5: 'vatTotal',
    }
    const result = {}
    let offset = 0

    while (offset < bytes.length) {
      if (offset + 2 > bytes.length) break
      const tag = bytes[offset]
      const length = bytes[offset + 1]
      if (offset + 2 + length > bytes.length) break
      const value = new TextDecoder().decode(bytes.slice(offset + 2, offset + 2 + length))
      result[tagNames[tag] || `tag_${tag}`] = value
      offset += 2 + length
    }

    return result
  } catch (error) {
    console.error('[ZATCA QR] Decode failed:', error.message)
    throw new Error('Invalid ZATCA QR payload')
  }
}

export const verifyQrIntegrity = (base64) => {
  try {
    const decoded = decodeZatcaQrValue(base64)
    const validation = validateZatcaQrFields({
      sellerName: decoded.sellerName,
      vatNumber: decoded.vatNumber,
      totalWithVat: decoded.totalWithVat,
      vatTotal: decoded.vatTotal,
    })

    return {
      valid: validation.valid,
      errors: validation.errors,
      decoded,
    }
  } catch (error) {
    return {
      valid: false,
      errors: [error.message],
      decoded: null,
    }
  }
}
