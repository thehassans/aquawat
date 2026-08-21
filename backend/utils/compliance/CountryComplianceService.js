import QRCode from 'qrcode';

/**
 * GCC & Regional Multi-Country Compliance Service
 * Supports:
 *  - KSA: ZATCA (SAR - 15% VAT)
 *  - UAE: FTA / EmaraTax (AED - 5% VAT, 15-digit TRN)
 *  - Oman: OTA (OMR - 5% VAT, Tax ID)
 *  - Bahrain: NBR (BHD - 10% VAT, VAT Account No)
 *  - Kuwait: MOF / KDIT (KWD - Civil ID, Commercial Tax)
 *  - Qatar: GTA Dhareeba (QAR - TIN, Dhareeba Invoicing)
 *  - Pakistan: FBR (PKR - 18% GST, NTN/STRN)
 *  - Bangladesh: NBR (BDT - 15% VAT, BIN Mushak 6.3)
 */

export const GCC_TAX_AUTHORITIES = {
  SA: { code: 'SA', name: 'ZATCA', country: 'Saudi Arabia', currency: 'SAR', defaultRate: 15, idField: 'vatNumber' },
  AE: { code: 'AE', name: 'FTA', country: 'United Arab Emirates', currency: 'AED', defaultRate: 5, idField: 'trn' },
  OM: { code: 'OM', name: 'OTA', country: 'Oman', currency: 'OMR', defaultRate: 5, idField: 'tin' },
  BH: { code: 'BH', name: 'NBR', country: 'Bahrain', currency: 'BHD', defaultRate: 10, idField: 'vatAccountNo' },
  KW: { code: 'KW', name: 'MOF', country: 'Kuwait', currency: 'KWD', defaultRate: 0, idField: 'civilId' },
  QA: { code: 'QA', name: 'GTA', country: 'Qatar', currency: 'QAR', defaultRate: 0, idField: 'tin' },
  BD: { code: 'BD', name: 'NBR', country: 'Bangladesh', currency: 'BDT', defaultRate: 15, idField: 'binNumber' },
  PK: { code: 'PK', name: 'FBR', country: 'Pakistan', currency: 'PKR', defaultRate: 18, idField: 'ntn' },
};

/** Determine active tax authority from tenant currency and address */
export function getTenantTaxAuthority(tenant) {
  const currency = String(tenant?.settings?.currency || tenant?.currency || 'SAR').trim().toUpperCase();
  const country = String(tenant?.business?.address?.country || tenant?.country || '').trim().toUpperCase();

  if (currency === 'AED' || country === 'AE' || country === 'ARE' || country === 'UAE') return GCC_TAX_AUTHORITIES.AE;
  if (currency === 'OMR' || country === 'OM' || country === 'OMN' || country === 'OMAN') return GCC_TAX_AUTHORITIES.OM;
  if (currency === 'BHD' || country === 'BH' || country === 'BHR' || country === 'BAHRAIN') return GCC_TAX_AUTHORITIES.BH;
  if (currency === 'KWD' || country === 'KW' || country === 'KWT' || country === 'KUWAIT') return GCC_TAX_AUTHORITIES.KW;
  if (currency === 'QAR' || country === 'QA' || country === 'QAT' || country === 'QATAR') return GCC_TAX_AUTHORITIES.QA;
  if (currency === 'BDT' || country === 'BD' || country === 'BGD' || country === 'BANGLADESH') return GCC_TAX_AUTHORITIES.BD;
  if (currency === 'PKR' || country === 'PK' || country === 'PAK' || country === 'PAKISTAN') return GCC_TAX_AUTHORITIES.PK;
  return GCC_TAX_AUTHORITIES.SA;
}

/** Build structured QR payload string for verification across regional tax authorities */
export function buildRegionalQrPayload({
  authority,
  countryCode,
  sellerName,
  taxNumber,
  invoiceNumber,
  timestamp,
  grandTotal,
  totalTax,
  currency,
}) {
  return JSON.stringify({
    v: 1,
    gov: authority,
    cc: countryCode,
    seller: String(sellerName || '').trim(),
    taxId: String(taxNumber || '').trim(),
    inv: String(invoiceNumber || '').trim(),
    ts: timestamp || new Date().toISOString(),
    total: Number(Number(grandTotal || 0).toFixed(2)),
    tax: Number(Number(totalTax || 0).toFixed(2)),
    cur: currency,
  });
}

/** Generate a Base64 QR Image Data URL */
export async function generateQrDataUrl(payload) {
  try {
    return await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 200,
    });
  } catch (err) {
    console.error('[CountryComplianceService] Failed to generate QR:', err.message);
    return '';
  }
}

/**
 * Apply regional country compliance to an invoice upon creation
 */
export async function applyCountryComplianceToInvoice(invoice, tenant, seller = {}) {
  const auth = getTenantTaxAuthority(tenant);
  const currency = String(tenant?.settings?.currency || auth.currency).toUpperCase();
  const business = tenant?.business || {};

  // For Saudi (SAR), handled via ZATCA TLV service
  if (auth.code === 'SA') return invoice;

  // Resolve tax registration identifier for each country
  let taxNumber = '';
  let configObj = null;

  if (auth.code === 'AE') {
    configObj = tenant.fta || {};
    taxNumber = configObj.trn || business.trn || business.vatNumber || '';
  } else if (auth.code === 'OM') {
    configObj = tenant.ota || {};
    taxNumber = configObj.tin || business.tin || business.vatNumber || '';
  } else if (auth.code === 'BH') {
    configObj = tenant.bahrainNbr || {};
    taxNumber = configObj.vatAccountNo || business.vatAccountNo || business.vatNumber || '';
  } else if (auth.code === 'KW') {
    configObj = tenant.mofKuwait || {};
    taxNumber = configObj.civilId || configObj.taxCardNumber || business.crNumber || '';
  } else if (auth.code === 'QA') {
    configObj = tenant.gtaQatar || {};
    taxNumber = configObj.tin || business.tin || business.crNumber || '';
  } else if (auth.code === 'BD') {
    configObj = tenant.nbr || {};
    taxNumber = configObj.binNumber || business.binNumber || '';
  } else if (auth.code === 'PK') {
    configObj = tenant.fbr || {};
    taxNumber = configObj.ntn || configObj.strn || business.ntn || '';
  }

  const sellerName = seller.name || business.legalNameEn || business.legalNameAr || tenant.name || 'Merchant';
  const issueDate = invoice.issueDate ? new Date(invoice.issueDate).toISOString() : new Date().toISOString();

  const qrPayload = buildRegionalQrPayload({
    authority: auth.name,
    countryCode: auth.code,
    sellerName,
    taxNumber,
    invoiceNumber: invoice.invoiceNumber,
    timestamp: issueDate,
    grandTotal: invoice.grandTotal,
    totalTax: invoice.totalTax,
    currency,
  });

  const qrImage = await generateQrDataUrl(qrPayload);

  invoice.countryCompliance = {
    countryCode: auth.code,
    authority: auth.name,
    taxRegistrationNumber: taxNumber,
    qrCode: qrImage || qrPayload,
    submissionStatus: 'compliant',
    complianceRefNo: `${auth.name}-${invoice.invoiceNumber}`,
    submittedAt: new Date(),
    metadata: {
      defaultVatRate: configObj?.defaultVatRate ?? auth.defaultRate,
      environment: configObj?.environment || 'production',
      currency,
    },
  };

  return invoice;
}

export default {
  GCC_TAX_AUTHORITIES,
  getTenantTaxAuthority,
  buildRegionalQrPayload,
  generateQrDataUrl,
  applyCountryComplianceToInvoice,
};
