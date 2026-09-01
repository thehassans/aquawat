import crypto from 'crypto';
import { formatZatcaQrTimestamp } from '../utils/zatcaTimestamp.js';

/**
 * ZATCA Phase 2 QR Code Helper
 * Implements the TLMV (Tag-Length-Value Minimum) encoding specified in
 * ZATCA's E-Invoicing Implementation Standards v2.3.
 *
 * Tags:
 *   1 - Seller Name (UTF-8)
 *   2 - Seller VAT Registration Number (UTF-8)
 *   3 - Invoice Timestamp (ISO 8601)
 *   4 - Invoice Total Amount (with VAT) as string
 *   5 - VAT Amount as string
 *
 * Each field is encoded as: [tag_byte] [length_byte(s)] [value_bytes]
 * The full buffer is then Base64-encoded for embedding in a QR code.
 *
 * Note: This covers the MINIMUM QR fields required by ZATCA Phase 2 B2C
 * invoices (simplified tax invoices). B2B (standard) invoices require
 * additional fields and cryptographic signing via the Phase 2 APIs.
 */

const VAT_NUMBER_REGEX = /^[0-9]{15}$/;

/**
 * Validate ZATCA QR input fields before encoding.
 * @param {object} params
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateZatcaQrFields({ sellerName, vatNumber, totalAmount, vatAmount }) {
  const errors = [];

  if (!sellerName || String(sellerName).trim().length === 0) {
    errors.push('Seller name is required');
  }
  if (!vatNumber || !VAT_NUMBER_REGEX.test(String(vatNumber))) {
    errors.push('VAT number must be exactly 15 digits');
  }
  const total = Number(totalAmount);
  if (!Number.isFinite(total) || total < 0) {
    errors.push('Total amount must be a non-negative number');
  }
  const vat = Number(vatAmount);
  if (!Number.isFinite(vat) || vat < 0) {
    errors.push('VAT amount must be a non-negative number');
  }
  if (Number.isFinite(total) && Number.isFinite(vat) && vat > total) {
    errors.push('VAT amount cannot exceed total amount');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Encode a single TLMV field.
 * @param {number} tag   - Tag byte (1-5)
 * @param {string} value - UTF-8 string value
 * @returns {Buffer}
 */
function encodeTLVField(tag, value) {
  const valueBuffer = Buffer.from(value, 'utf8');
  const length = valueBuffer.length;

  // Support length up to 255 bytes (single byte length)
  if (length > 255) {
    throw new Error(`ZATCA QR field ${tag} value too long (${length} bytes)`);
  }

  const tagBuffer = Buffer.alloc(1);
  tagBuffer.writeUInt8(tag, 0);

  const lengthBuffer = Buffer.alloc(1);
  lengthBuffer.writeUInt8(length, 0);

  return Buffer.concat([tagBuffer, lengthBuffer, valueBuffer]);
}

/**
 * Generate a ZATCA-compliant QR code payload.
 *
 * @param {object} params
 * @param {string}  params.sellerName        - Arabic or English seller name
 * @param {string}  params.vatNumber         - 15-digit Saudi VAT registration number
 * @param {Date|string} params.invoiceDate   - Invoice date/time
 * @param {string}  [params.issueTime]       - HH:mm:ss in Saudi local time
 * @param {number}  params.totalAmount       - Grand total including VAT
 * @param {number}  params.vatAmount         - VAT portion of the total
 * @returns {string} Base64-encoded TLMV payload suitable for a QR code
 */
export function generateZatcaQr({ sellerName, vatNumber, invoiceDate, issueTime, totalAmount, vatAmount }) {
  if (!sellerName || !vatNumber || !invoiceDate || totalAmount == null || vatAmount == null) {
    throw new Error('generateZatcaQr: all parameters are required');
  }

  const validation = validateZatcaQrFields({ sellerName, vatNumber, totalAmount, vatAmount });
  if (!validation.valid) {
    throw new Error(`generateZatcaQr validation failed: ${validation.errors.join(', ')}`);
  }

  const timestamp = formatZatcaQrTimestamp(invoiceDate, issueTime);

  // Format amounts to 2 decimal places as strings (ZATCA spec)
  const totalStr = Number(totalAmount).toFixed(2);
  const vatStr = Number(vatAmount).toFixed(2);

  const fields = Buffer.concat([
    encodeTLVField(1, sellerName),
    encodeTLVField(2, vatNumber),
    encodeTLVField(3, timestamp),
    encodeTLVField(4, totalStr),
    encodeTLVField(5, vatStr),
  ]);

  return fields.toString('base64');
}

/**
 * Generate QR for a RentalContract closure, using the tenant's ZATCA config.
 *
 * @param {object} contract   - The RentalContract document (or POJO)
 * @param {object} tenant     - The Tenant document (or POJO)
 * @returns {string} Base64 QR string
 */
export function generateContractZatcaQr(contract, tenant) {
  const sellerName = tenant?.business?.legalNameAr
    || tenant?.business?.legalNameEn
    || tenant?.name
    || 'Car Rental';

  const vatNumber = tenant?.business?.vatNumber || '000000000000000';
  const invoiceDate = contract.actualReturnDateTime || contract.updatedAt || new Date();
  const totalAmount = contract.grandTotal || 0;
  const vatAmount = contract.totalVat || 0;

  return generateZatcaQr({ sellerName, vatNumber, invoiceDate, totalAmount, vatAmount });
}

/**
 * Decode a ZATCA QR Base64 payload back to its field values.
 * Useful for verification / testing.
 *
 * @param {string} base64 - Base64-encoded TLMV payload
 * @returns {object} Decoded fields
 */
export function decodeZatcaQr(base64) {
  const buf = Buffer.from(base64, 'base64');
  const result = {};
  const tagNames = { 1: 'sellerName', 2: 'vatNumber', 3: 'timestamp', 4: 'totalAmount', 5: 'vatAmount' };
  let offset = 0;

  while (offset < buf.length) {
    if (offset + 2 > buf.length) break;
    const tag = buf.readUInt8(offset);
    const length = buf.readUInt8(offset + 1);
    if (offset + 2 + length > buf.length) break;
    const value = buf.slice(offset + 2, offset + 2 + length).toString('utf8');
    result[tagNames[tag] || `tag_${tag}`] = value;
    offset += 2 + length;
  }

  return result;
}

/**
 * Verify the integrity of a ZATCA QR payload by decoding and validating its fields.
 * @param {string} base64 - Base64-encoded TLMV payload
 * @returns {{ valid: boolean, errors: string[], decoded: object|null }}
 */
export function verifyQrIntegrity(base64) {
  try {
    const decoded = decodeZatcaQr(base64);
    const validation = validateZatcaQrFields({
      sellerName: decoded.sellerName,
      vatNumber: decoded.vatNumber,
      totalAmount: decoded.totalAmount,
      vatAmount: decoded.vatAmount,
    });
    return { valid: validation.valid, errors: validation.errors, decoded };
  } catch (error) {
    return { valid: false, errors: [error.message], decoded: null };
  }
}

/**
 * Compute a SHA-256 hash of a canonical invoice representation for chain linking.
 * @param {object} invoice - Invoice document or POJO
 * @returns {string} Base64-encoded hash
 */
export function computeInvoiceHash(invoice) {
  const canonical = JSON.stringify({
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    sellerVat: invoice.seller?.vatNumber || invoice.seller?.vatRegistrationNumber,
    total: invoice.grandTotal,
    tax: invoice.totalTax,
    lines: (invoice.lineItems || []).map((l) => ({
      name: l.productName || l.name,
      qty: l.quantity,
      total: l.lineTotal,
    })),
  });
  return crypto.createHash('sha256').update(canonical).digest('base64');
}

/**
 * Verify the invoice hash chain by recomputing the current hash and
 * comparing it against the stored previous hash.
 *
 * @param {object} invoice  - Current invoice with zatca.invoiceHash
 * @param {string} previousHash - Base64 hash of the previous invoice
 * @returns {{ valid: boolean, currentHash: string, expectedChainedHash: string }}
 */
export function verifyHashChain(invoice, previousHash) {
  const currentHash = computeInvoiceHash(invoice);
  const combinedData = (previousHash || '') + currentHash;
  const expectedChainedHash = crypto.createHash('sha256').update(combinedData).digest('base64');
  const storedHash = invoice.zatca?.invoiceHash || invoice.zatca?.xmlHash || '';
  return {
    valid: storedHash === expectedChainedHash,
    currentHash,
    expectedChainedHash,
  };
}

/**
 * Disaster recovery: rebuild the invoice hash chain for a tenant.
 * Given an array of invoices sorted by issueDate, recompute each invoice's
 * hash and link it to the previous one. Returns the updated chain data.
 *
 * @param {Array} invoices - Array of invoice documents sorted by date
 * @param {string} seedHash - Initial previous hash (default ZATCA seed)
 * @returns {Array} Array of { invoiceId, invoiceNumber, invoiceHash, previousInvoiceHash }
 */
export function rebuildHashChain(invoices, seedHash) {
  const DEFAULT_SEED = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';
  let previousHash = seedHash || DEFAULT_SEED;
  const results = [];

  for (const invoice of invoices) {
    const currentHash = computeInvoiceHash(invoice);
    const combinedData = previousHash + currentHash;
    const chainedHash = crypto.createHash('sha256').update(combinedData).digest('base64');

    results.push({
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceHash: chainedHash,
      previousInvoiceHash: previousHash,
    });

    previousHash = chainedHash;
  }

  return results;
}

/**
 * Generate a new ECDSA key pair for ZATCA compliance.
 * Returns PEM-encoded private and public keys.
 *
 * @returns {{ privateKey: string, publicKey: string }}
 */
export function generateKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return { privateKey, publicKey };
}
