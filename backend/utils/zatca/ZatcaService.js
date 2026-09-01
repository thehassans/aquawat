import crypto from 'crypto';
import forge from 'node-forge';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import Handlebars from 'handlebars';
import momentHijri from 'moment-hijri';
import { consumeRateLimit } from '../zatcaRateLimiter.js';
import { formatRiyadhParts, formatZatcaQrTimestamp, RIYADH_TZ } from '../zatcaTimestamp.js';

class ZatcaService {
  constructor(config = {}) {
    this.privateKey = config.privateKey || null;
    this.certificate = config.certificate || null;
    this.csid = config.csid || null;
    this.tenantId = config.tenantId || null;
    this.previousInvoiceHash = config.previousInvoiceHash || 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';
  }

  /**
   * Generate UBL 2.1 XML Invoice
   */
  generateXML(invoice, seller, isSimplified = false) {
    const template = this.getXMLTemplate();
    const compiledTemplate = Handlebars.compile(template);
    
    const invoiceData = {
      uuid: invoice.zatca?.uuid || uuidv4(),
      invoiceNumber: invoice.invoiceNumber,
      issueDate: this.formatDate(invoice.issueDate),
      issueTime: invoice.issueTime || this.formatTime(invoice.issueDate, invoice.issueTime),
      invoiceTypeCode: invoice.invoiceTypeCode,
      invoiceType: invoice.invoiceType || '388',
      currencyCode: invoice.currency || 'SAR',
      previousInvoiceHash: this.previousInvoiceHash,
      invoiceCounter: invoice.zatca?.invoiceCounter || 1,
      
      // Seller
      sellerName: seller.legalNameEn,
      sellerNameAr: seller.legalNameAr,
      sellerVatNumber: seller.vatNumber,
      sellerStreet: seller.address?.street || '',
      sellerDistrict: seller.address?.district || '',
      sellerCity: seller.address?.city || '',
      sellerPostalCode: seller.address?.postalCode || '',
      sellerCountry: seller.address?.country || 'SA',
      sellerBuildingNumber: seller.address?.buildingNumber || '',
      sellerAdditionalNumber: seller.address?.additionalNumber || '',
      sellerCrNumber: seller.crNumber || '',
      
      // Buyer
      buyerName: invoice.buyer?.name || '',
      buyerNameAr: invoice.buyer?.nameAr || '',
      buyerVatNumber: invoice.buyer?.vatNumber || '',
      buyerStreet: invoice.buyer?.address?.street || '',
      buyerDistrict: invoice.buyer?.address?.district || '',
      buyerCity: invoice.buyer?.address?.city || '',
      buyerPostalCode: invoice.buyer?.address?.postalCode || '',
      buyerCountry: invoice.buyer?.address?.country || 'SA',
      buyerBuildingNumber: invoice.buyer?.address?.buildingNumber || '',
      
      // Totals
      taxExclusiveAmount: this.formatAmount(invoice.taxableAmount),
      taxInclusiveAmount: this.formatAmount(invoice.grandTotal),
      allowanceTotalAmount: this.formatAmount(invoice.totalDiscount || 0),
      payableAmount: this.formatAmount(invoice.grandTotal),
      taxAmount: this.formatAmount(invoice.totalTax),
      
      // Lines
      //
      // For travel-agency margin-scheme lines the customer's quoted unit price
      // already includes the tax on the agency margin, so the ZATCA line math
      // (qty × priceAmount = lineExtensionAmount) must be driven from the
      // tax-exclusive line total rather than any of the customer-facing /
      // agency prices. The customer-facing PDF reads `customerPrice`, so this
      // has no effect on what the customer sees; it only keeps the ZATCA XML
      // internally consistent (BR-CO-04). The QR uses invoice.grandTotal and
      // invoice.totalTax — agencyPrice and unitPrice never leak to the QR.
      lineItems: invoice.lineItems.map((line, index) => {
        const quantity = Number(line.quantity) || 0;
        const isMarginLine = Boolean(line.isTravelMargin);
        const priceAmount = isMarginLine && quantity > 0
          ? (Number(line.lineTotal) || 0) / quantity
          : Number(line.unitPrice) || 0;

        return {
          id: line.lineNumber || index + 1,
          quantity: line.quantity,
          unitCode: line.unitCode || 'PCE',
          lineExtensionAmount: this.formatAmount(line.lineTotal),
          itemName: line.productName,
          itemNameAr: line.productNameAr || line.productName,
          priceAmount: this.formatAmount(priceAmount),
          taxAmount: this.formatAmount(line.taxAmount),
          taxCategory: line.taxCategory || 'S',
          taxPercent: line.taxRate || 15,
          roundingAmount: this.formatAmount(line.lineTotalWithTax)
        };
      }),
      
      // Tax Breakdown
      taxSubtotals: this.calculateTaxSubtotals(invoice.lineItems),
      
      isSimplified
    };
    
    return compiledTemplate(invoiceData);
  }

  /**
   * Calculate SHA-256 hash of invoice XML
   */
  calculateHash(xmlContent) {
    const cleanXml = this.canonicalizeXml(xmlContent);
    const hash = crypto.createHash('sha256').update(cleanXml, 'utf8').digest();
    return hash.toString('base64');
  }

  /**
   * Generate invoice hash with chain linking (blockchain-style)
   */
  generateInvoiceHash(xmlContent, previousHash) {
    const currentHash = this.calculateHash(xmlContent);
    const combinedData = previousHash + currentHash;
    const chainedHash = crypto.createHash('sha256').update(combinedData, 'utf8').digest('base64');
    return {
      currentHash,
      chainedHash,
      previousHash
    };
  }

  /**
   * Sign invoice hash using ECDSA (secp256k1)
   */
  signInvoice(invoiceHash) {
    if (!this.privateKey) {
      throw new Error('Private key not configured');
    }

    try {
      const sign = crypto.createSign('SHA256');
      sign.update(invoiceHash);
      sign.end();
      
      const signature = sign.sign({
        key: this.privateKey,
        dsaEncoding: 'ieee-p1363'
      }, 'base64');
      
      return signature;
    } catch (error) {
      // Fallback using node-forge for ECDSA
      return this.signWithForge(invoiceHash);
    }
  }

  /**
   * Sign using node-forge (fallback)
   */
  signWithForge(data) {
    const md = forge.md.sha256.create();
    md.update(data, 'utf8');
    
    const privateKey = forge.pki.privateKeyFromPem(this.privateKey);
    const signature = privateKey.sign(md);
    
    return forge.util.encode64(signature);
  }

  /**
   * Generate TLV (Tag-Length-Value) encoded QR code data
   */
  generateTLV(data) {
    const tlvData = [];
    
    // Tag 1: Seller Name
    tlvData.push(this.createTLVField(1, data.sellerName));
    
    // Tag 2: VAT Registration Number
    tlvData.push(this.createTLVField(2, data.vatNumber));
    
    // Tag 3: Timestamp (ISO 8601)
    tlvData.push(this.createTLVField(3, data.timestamp));
    
    // Tag 4: Invoice Total (with VAT)
    tlvData.push(this.createTLVField(4, data.totalWithVat.toString()));
    
    // Tag 5: VAT Total
    tlvData.push(this.createTLVField(5, data.vatTotal.toString()));
    
    // Tag 6: Invoice Hash
    if (data.invoiceHash) {
      tlvData.push(this.createTLVField(6, data.invoiceHash));
    }
    
    // Tag 7: ECDSA Signature
    if (data.signature) {
      tlvData.push(this.createTLVField(7, data.signature));
    }
    
    // Tag 8: Public Key (ECDSA)
    if (data.publicKey) {
      tlvData.push(this.createTLVField(8, data.publicKey));
    }
    
    // Tag 9: Certificate Signature (for signed invoices)
    if (data.certificateSignature) {
      tlvData.push(this.createTLVField(9, data.certificateSignature));
    }
    
    const tlvBuffer = Buffer.concat(tlvData);
    return tlvBuffer.toString('base64');
  }

  /**
   * Create individual TLV field
   */
  createTLVField(tag, value) {
    const safeValue = value === null || value === undefined ? '' : String(value);
    const valueBuffer = Buffer.from(safeValue, 'utf8');
    const tagBuffer = Buffer.from([tag]);
    const lengthBuffer = Buffer.from([valueBuffer.length]);
    
    return Buffer.concat([tagBuffer, lengthBuffer, valueBuffer]);
  }

  /**
   * Generate QR Code image from TLV data
   */
  async generateQRCode(tlvData) {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(tlvData, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 200,
        margin: 2
      });
      return qrCodeDataUrl;
    } catch (error) {
      throw new Error(`QR Code generation failed: ${error.message}`);
    }
  }

  /**
   * Complete invoice signing workflow
   */
  async processInvoice(invoice, seller, isB2C = false) {
    try {
      // Generate UUID if not exists
      const uuid = invoice.zatca?.uuid || uuidv4();
      const invoiceCounter = (invoice.zatca?.invoiceCounter || 0) + 1;
      
      // Set invoice type code based on transaction type
      const invoiceTypeCode = isB2C ? '0200000' : '0100000';
      
      // Generate XML
      const xml = this.generateXML({
        ...invoice,
        invoiceTypeCode,
        zatca: { uuid, invoiceCounter }
      }, seller, isB2C);
      
      // Calculate hash with chain linking
      const hashResult = this.generateInvoiceHash(xml, this.previousInvoiceHash);
      
      // Sign the invoice
      const signature = this.signInvoice(hashResult.chainedHash);
      
      // Get public key hash
      const publicKeyHash = this.getPublicKeyHash();
      
      // Generate TLV QR data
      const tlvData = this.generateTLV({
        sellerName: seller.legalNameAr || seller.legalNameEn,
        vatNumber: seller.vatNumber,
        timestamp: formatZatcaQrTimestamp(invoice.issueDate, invoice.issueTime),
        totalWithVat: invoice.grandTotal.toFixed(2),
        vatTotal: invoice.totalTax.toFixed(2),
        invoiceHash: hashResult.chainedHash,
        signature: signature,
        publicKey: publicKeyHash
      });
      
      // Generate QR Code image
      const qrCodeImage = await this.generateQRCode(tlvData);
      
      // Embed signature and QR in XML
      const signedXml = this.embedSignatureInXml(xml, signature, hashResult.chainedHash);
      
      // Update previous hash for next invoice
      this.previousInvoiceHash = hashResult.chainedHash;
      
      return {
        uuid,
        invoiceCounter,
        xml: signedXml,
        previousInvoiceHash: hashResult.previousHash,
        invoiceHash: hashResult.chainedHash,
        digitalSignature: signature,
        publicKeyHash,
        qrCodeData: tlvData,
        qrCodeImage,
        submissionStatus: isB2C ? 'pending' : 'pending'
      };
    } catch (error) {
      throw new Error(`Invoice processing failed: ${error.message}`);
    }
  }

  /**
   * Submit invoice to ZATCA for clearance (B2B)
   */
  async submitForClearance(signedXml, invoiceHash, uuid) {
    if (this.tenantId) consumeRateLimit(this.tenantId);
    const apiUrl = process.env.ZATCA_API_URL || 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal';
    
    const payload = {
      invoiceHash,
      uuid,
      invoice: Buffer.from(signedXml).toString('base64')
    };
    
    try {
      const response = await fetch(`${apiUrl}/invoices/clearance/single`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Basic ${this.csid}`,
          'Accept-Language': 'en',
          'Clearance-Status': '1',
          'Accept-Version': 'V2'
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      return {
        success: response.ok,
        status: response.status,
        clearanceStatus: result.clearanceStatus,
        reportingStatus: result.reportingStatus,
        validationResults: result.validationResults,
        clearedInvoice: result.clearedInvoice,
        warnings: result.warnings || [],
        errors: result.errors || []
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Submit invoice to ZATCA for reporting (B2C batch)
   */
  async submitForReporting(signedXml, invoiceHash, uuid) {
    if (this.tenantId) consumeRateLimit(this.tenantId);
    const apiUrl = process.env.ZATCA_API_URL || 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal';
    
    const payload = {
      invoiceHash,
      uuid,
      invoice: Buffer.from(signedXml).toString('base64')
    };
    
    try {
      const response = await fetch(`${apiUrl}/invoices/reporting/single`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Basic ${this.csid}`,
          'Accept-Language': 'en',
          'Accept-Version': 'V2'
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      return {
        success: response.ok,
        status: response.status,
        reportingStatus: result.reportingStatus,
        validationResults: result.validationResults,
        warnings: result.warnings || [],
        errors: result.errors || []
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Helper methods
  formatDate(date) {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  formatTime(date, issueTime) {
    const time = String(issueTime || '').trim();
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(time)) {
      const [hh, mm, ss = '00'] = time.split(':');
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }
    const parts = formatRiyadhParts(date, RIYADH_TZ);
    if (!parts) return '00:00:00';
    return `${parts.hour}:${parts.minute}:${parts.second}`;
  }

  formatAmount(amount) {
    return (amount || 0).toFixed(2);
  }

  canonicalizeXml(xml) {
    // Remove XML declaration and whitespace between tags
    return xml
      .replace(/<\?xml[^?]*\?>/g, '')
      .replace(/>\s+</g, '><')
      .trim();
  }

  getPublicKeyHash() {
    if (!this.privateKey) return '';
    try {
      const keyObject = crypto.createPublicKey(this.privateKey);
      const publicKey = keyObject.export({ type: 'spki', format: 'der' });
      return crypto.createHash('sha256').update(publicKey).digest('base64');
    } catch {
      return '';
    }
  }

  embedSignatureInXml(xml, signature, hash) {
    // Add UBL Extensions with signature
    const signatureExtension = `
      <ext:UBLExtensions>
        <ext:UBLExtension>
          <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
          <ext:ExtensionContent>
            <sig:UBLDocumentSignatures>
              <sac:SignatureInformation>
                <cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>
                <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
                <ds:Signature Id="signature">
                  <ds:SignedInfo>
                    <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                    <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
                    <ds:Reference URI="">
                      <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                      <ds:DigestValue>${hash}</ds:DigestValue>
                    </ds:Reference>
                  </ds:SignedInfo>
                  <ds:SignatureValue>${signature}</ds:SignatureValue>
                </ds:Signature>
              </sac:SignatureInformation>
            </sig:UBLDocumentSignatures>
          </ext:ExtensionContent>
        </ext:UBLExtension>
      </ext:UBLExtensions>`;
    
    // Insert after XML declaration
    return xml.replace('<?xml version="1.0" encoding="UTF-8"?>', 
      `<?xml version="1.0" encoding="UTF-8"?>\n${signatureExtension}`);
  }

  calculateTaxSubtotals(lineItems) {
    const taxGroups = {};
    
    lineItems.forEach(line => {
      const category = line.taxCategory || 'S';
      const rate = line.taxRate || 15;
      const key = `${category}-${rate}`;
      
      if (!taxGroups[key]) {
        taxGroups[key] = {
          category,
          rate,
          taxableAmount: 0,
          taxAmount: 0
        };
      }
      
      taxGroups[key].taxableAmount += line.lineTotal || 0;
      taxGroups[key].taxAmount += line.taxAmount || 0;
    });
    
    return Object.values(taxGroups).map(group => ({
      ...group,
      taxableAmount: this.formatAmount(group.taxableAmount),
      taxAmount: this.formatAmount(group.taxAmount)
    }));
  }

  getXMLTemplate() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>{{invoiceNumber}}</cbc:ID>
  <cbc:UUID>{{uuid}}</cbc:UUID>
  <cbc:IssueDate>{{issueDate}}</cbc:IssueDate>
  <cbc:IssueTime>{{issueTime}}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="{{invoiceTypeCode}}">{{invoiceType}}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>{{currencyCode}}</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>{{currencyCode}}</cbc:TaxCurrencyCode>
  
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>{{invoiceCounter}}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">{{previousInvoiceHash}}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>

  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="CRN">{{sellerCrNumber}}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>{{sellerStreet}}</cbc:StreetName>
        <cbc:BuildingNumber>{{sellerBuildingNumber}}</cbc:BuildingNumber>
        <cbc:PlotIdentification>{{sellerAdditionalNumber}}</cbc:PlotIdentification>
        <cbc:CitySubdivisionName>{{sellerDistrict}}</cbc:CitySubdivisionName>
        <cbc:CityName>{{sellerCity}}</cbc:CityName>
        <cbc:PostalZone>{{sellerPostalCode}}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>{{sellerCountry}}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>{{sellerVatNumber}}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>{{sellerNameAr}}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>

  {{#unless isSimplified}}
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:StreetName>{{buyerStreet}}</cbc:StreetName>
        <cbc:BuildingNumber>{{buyerBuildingNumber}}</cbc:BuildingNumber>
        <cbc:CitySubdivisionName>{{buyerDistrict}}</cbc:CitySubdivisionName>
        <cbc:CityName>{{buyerCity}}</cbc:CityName>
        <cbc:PostalZone>{{buyerPostalCode}}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>{{buyerCountry}}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>{{buyerVatNumber}}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>{{buyerNameAr}}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  {{/unless}}

  <cac:AllowanceCharge>
    <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
    <cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason>
    <cbc:Amount currencyID="{{currencyCode}}">{{allowanceTotalAmount}}</cbc:Amount>
    <cac:TaxCategory>
      <cbc:ID>S</cbc:ID>
      <cbc:Percent>15</cbc:Percent>
      <cac:TaxScheme>
        <cbc:ID>VAT</cbc:ID>
      </cac:TaxScheme>
    </cac:TaxCategory>
  </cac:AllowanceCharge>

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="{{currencyCode}}">{{taxAmount}}</cbc:TaxAmount>
    {{#each taxSubtotals}}
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="{{../currencyCode}}">{{taxableAmount}}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="{{../currencyCode}}">{{taxAmount}}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>{{category}}</cbc:ID>
        <cbc:Percent>{{rate}}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
    {{/each}}
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="{{currencyCode}}">{{taxExclusiveAmount}}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="{{currencyCode}}">{{taxExclusiveAmount}}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="{{currencyCode}}">{{taxInclusiveAmount}}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="{{currencyCode}}">{{allowanceTotalAmount}}</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="{{currencyCode}}">{{payableAmount}}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  {{#each lineItems}}
  <cac:InvoiceLine>
    <cbc:ID>{{id}}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="{{unitCode}}">{{quantity}}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="{{../currencyCode}}">{{lineExtensionAmount}}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="{{../currencyCode}}">{{taxAmount}}</cbc:TaxAmount>
      <cbc:RoundingAmount currencyID="{{../currencyCode}}">{{roundingAmount}}</cbc:RoundingAmount>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>{{itemNameAr}}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>{{taxCategory}}</cbc:ID>
        <cbc:Percent>{{taxPercent}}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="{{../currencyCode}}">{{priceAmount}}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>
  {{/each}}
</Invoice>`;
  }

  /**
   * Generate keys for ZATCA onboarding
   */
  static generateKeyPair() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp256k1',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' }
    });
    
    return { privateKey, publicKey };
  }

  /**
   * Generate CSR for ZATCA compliance
   */
  static generateCSR(privateKey, organizationInfo) {
    const keys = forge.pki.privateKeyFromPem(privateKey);
    const csr = forge.pki.createCertificationRequest();
    
    csr.publicKey = forge.pki.setRsaPublicKey(keys.n, keys.e);
    
    csr.setSubject([
      { name: 'commonName', value: organizationInfo.commonName },
      { name: 'organizationName', value: organizationInfo.organizationName },
      { name: 'organizationalUnitName', value: organizationInfo.organizationalUnit || 'IT' },
      { name: 'countryName', value: 'SA' },
      { shortName: 'serialNumber', value: organizationInfo.vatNumber }
    ]);
    
    csr.sign(keys, forge.md.sha256.create());
    
    return forge.pki.certificationRequestToPem(csr);
  }
}

export default ZatcaService;
