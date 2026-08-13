import express from 'express';
import Tenant from '../models/Tenant.js';
import { protect, authorize, invalidateAuthCache } from '../middleware/auth.js';
import { resolveTenantId, handleTenantScopeError } from '../utils/tenantScope.js';
import ZatcaService from '../utils/zatca/ZatcaService.js';
import { hasPremiumTemplateAccess, ESSENTIAL_TEMPLATE_ID, MAX_TEMPLATE_ID } from '../utils/premiumTemplates.js';
import { streamSingleTenantBackup } from '../utils/tenantBackupStream.js';
import multer from 'multer';
import sharp from 'sharp';
import Customer from '../models/Customer.js';
import Employee from '../models/Employee.js';
import Expense from '../models/Expense.js';
import Invoice from '../models/Invoice.js';
import Product from '../models/Product.js';
import Project from '../models/Project.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Shipment from '../models/Shipment.js';
import Supplier from '../models/Supplier.js';
import Task from '../models/Task.js';
import Warehouse from '../models/Warehouse.js';
import Payroll from '../models/Payroll.js';
import IoTDevice from '../models/IoTDevice.js';
import IoTReading from '../models/IoTReading.js';
import { WhatsAppConfig, WhatsAppContact, WhatsAppMessage, WhatsAppTemplate, QuickReply, Broadcast } from '../models/WhatsApp.js';
import { getPrimaryBusinessType, normalizeBusinessTypes } from '../utils/businessTypes.js';
import { serializeAuthTenant } from '../utils/authSerialize.js';
import { TRIAL_LIMITS } from '../middleware/trialLimits.js';
import { imageFileFilter } from '../utils/uploadMime.js';
import { saveUploadBuffer } from '../utils/objectStorage.js';
import { encryptPrivateKey } from '../utils/zatcaKeyVault.js';
import netBuiltin from 'net';

const router = express.Router();

/** Allow only RFC1918 private IPs + localhost for printer TCP connects (SSRF guard). */
function assertPrivatePrinterHost(ipAddress) {
  const host = String(ipAddress || '').trim().toLowerCase();
  if (!host) {
    const err = new Error('IP address is required');
    err.status = 400;
    throw err;
  }

  // Block link-local / cloud metadata explicitly (even if somehow classified oddly)
  if (host === '169.254.169.254' || host.startsWith('169.254.')) {
    const err = new Error('Printer host is not allowed');
    err.status = 400;
    throw err;
  }

  if (host === 'localhost' || host === '::1' || host === '0:0:0:0:0:0:0:1') {
    return host;
  }

  // Reject hostnames — require literal IPv4/IPv6 to avoid DNS rebinding SSRF
  const isIp = netBuiltin.isIP(host);
  if (!isIp) {
    const err = new Error('Printer host must be a private IP address');
    err.status = 400;
    throw err;
  }

  if (isIp === 4) {
    const parts = host.split('.').map((p) => Number(p));
    const [a, b] = parts;
    const isPrivate =
      a === 10 ||
      a === 127 ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31);
    if (!isPrivate) {
      const err = new Error('Printer host must be a private (RFC1918) or localhost address');
      err.status = 400;
      throw err;
    }
    return host;
  }

  // IPv6: allow loopback only
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return host;
  const err = new Error('Printer host must be a private (RFC1918) or localhost address');
  err.status = 400;
  throw err;
}

router.use(protect);

const tenantIdOf = (req) => resolveTenantId(req.user, req);

// @route   GET /api/tenants/current
router.get('/current', async (req, res) => {
  try {
    const tenantId = tenantIdOf(req);
    if (!tenantId) {
      return res.status(404).json({ error: 'No tenant associated with user' });
    }
    
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    // Never return ZATCA private keys, CSIDs, SMTP passwords, or integration secrets
    res.json(serializeAuthTenant(tenant));
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/tenants/trial-limits
// @desc    Get current resource usage and limits for trial/demo tenants
router.get('/trial-limits', async (req, res) => {
  try {
    const tenantId = tenantIdOf(req);
    const tenant = await Tenant.findById(tenantId).lean();

    // Determine if tenant is on trial
    const isTrial = (tenant.isDemo === true && !tenant.demoUpgraded) || tenant.subscription?.plan === 'trial';

    if (!isTrial) {
      return res.json({ isTrial: false, limits: null });
    }

    // Count existing records for each resource type
    const MODEL_MAP = {
      invoices: Invoice,
      quotations: (await import('../models/Quotation.js')).default,
      customers: Customer,
      suppliers: Supplier,
      purchaseOrders: PurchaseOrder,
      products: Product,
      warehouses: Warehouse,
      users: (await import('../models/User.js')).default,
      projects: Project,
      tasks: Task,
      employees: Employee,
      expenses: Expense,
      shipments: Shipment,
    };

    const usage = {};
    const tenantFilter = { tenantId };

    for (const [resourceType, Model] of Object.entries(MODEL_MAP)) {
      if (Model && TRIAL_LIMITS[resourceType]) {
        const count = await Model.countDocuments(tenantFilter);
        usage[resourceType] = {
          current: count,
          limit: TRIAL_LIMITS[resourceType],
          remaining: Math.max(0, TRIAL_LIMITS[resourceType] - count),
        };
      }
    }

    res.json({ isTrial: true, limits: TRIAL_LIMITS, usage });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/tenants/current
router.put('/current', authorize('admin'), async (req, res) => {
  try {
    const { business, settings, branding, businessType, businessTypes } = req.body;
    
    const tenantId = tenantIdOf(req);
    if (!tenantId) {
      return res.status(404).json({ error: 'No tenant associated with user' });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Snapshot premium template entitlement BEFORE any settings are merged
    // in, so a request can't grant itself access by setting the template id
    // and having that very same (not-yet-saved) field read back as "already
    // premium".
    const hadPremiumTemplateAccess = hasPremiumTemplateAccess(tenant);

    // Merge business fields instead of replacing entire object
    if (business) {
      tenant.business = {
        ...tenant.business?.toObject?.() || tenant.business || {},
        ...business,
        address: {
          ...tenant.business?.address?.toObject?.() || tenant.business?.address || {},
          ...business.address
        }
      };
    }
    
    if (settings) {
      const currentSettings = tenant.settings?.toObject?.() || tenant.settings || {};
      tenant.settings = {
        ...currentSettings,
        ...settings,
        restaurant: {
          ...(currentSettings.restaurant || {}),
          ...(settings.restaurant || {}),
          qrMenu: {
            ...(currentSettings.restaurant?.qrMenu || {}),
            ...(settings.restaurant?.qrMenu || {}),
          },
          // Printers array: replace entirely if provided, otherwise keep current
          ...(settings.restaurant?.printers !== undefined ? { printers: settings.restaurant.printers } : {}),
          whatsapp: {
            ...(currentSettings.restaurant?.whatsapp || {}),
            ...(settings.restaurant?.whatsapp || {}),
          },
        },
        saloon: {
          ...(currentSettings.saloon || {}),
          ...(settings.saloon || {}),
          qrServices: {
            ...(currentSettings.saloon?.qrServices || {}),
            ...(settings.saloon?.qrServices || {}),
          }
        },
        communication: {
          ...(currentSettings.communication || {}),
          ...(settings.communication || {}),
          email: {
            ...(currentSettings.communication?.email || {}),
            ...(settings.communication?.email || {}),
          },
        },
        saudiIntegrations: {
          ...(currentSettings.saudiIntegrations || {}),
          ...(settings.saudiIntegrations || {}),
          gosi: {
            ...(currentSettings.saudiIntegrations?.gosi || {}),
            ...(settings.saudiIntegrations?.gosi || {}),
          },
          elm: {
            ...(currentSettings.saudiIntegrations?.elm || {}),
            ...(settings.saudiIntegrations?.elm || {}),
          },
          qiwa: {
            ...(currentSettings.saudiIntegrations?.qiwa || {}),
            ...(settings.saudiIntegrations?.qiwa || {}),
          },
          mudad: {
            ...(currentSettings.saudiIntegrations?.mudad || {}),
            ...(settings.saudiIntegrations?.mudad || {}),
          },
        },
        invoiceBranding: {
          ...(currentSettings.invoiceBranding || {}),
          ...(settings.invoiceBranding || {}),
        },
        posTerminal: {
          ...(currentSettings.posTerminal || {}),
          ...(settings.posTerminal || {}),
        },
        hardwareSettings: {
          ...(currentSettings.hardwareSettings || {}),
          ...(settings.hardwareSettings || {}),
        },
        thermalPrinter: {
          ...(currentSettings.thermalPrinter || {}),
          ...(settings.thermalPrinter || {}),
        },
      };
    }
    
    if (branding) {
      tenant.branding = { ...tenant.branding?.toObject?.() || tenant.branding || {}, ...branding };
      // Keep invoiceBranding logo and stamp/signature in sync with branding if provided
      if (branding.logo !== undefined) {
        if (!tenant.settings) tenant.settings = {};
        if (!tenant.settings.invoiceBranding) tenant.settings.invoiceBranding = {};
        tenant.settings.invoiceBranding.logo = branding.logo;
      }
      if (branding.stampImage !== undefined) {
        if (!tenant.settings) tenant.settings = {};
        if (!tenant.settings.invoiceBranding) tenant.settings.invoiceBranding = {};
        tenant.settings.invoiceBranding.stampImage = branding.stampImage;
      }
      if (branding.signatureImage !== undefined) {
        if (!tenant.settings) tenant.settings = {};
        if (!tenant.settings.invoiceBranding) tenant.settings.invoiceBranding = {};
        tenant.settings.invoiceBranding.signatureImage = branding.signatureImage;
      }
    } else if (settings?.invoiceBranding?.logo !== undefined) {
      if (!tenant.branding) tenant.branding = {};
      tenant.branding.logo = settings.invoiceBranding.logo;
    }

    // Templates 2-8 require the "Premium Invoice & Quotation Templates" App
    // Store add-on. Clamp any attempt to set a locked template back to the
    // free Essential template (1) instead of trusting the client. Uses the
    // pre-merge entitlement snapshot so this can't be self-granted in the
    // same request.
    if (settings) {
      const clampAgainstPriorAccess = (value) => {
        const numeric = Number(value);
        const safe = Number.isFinite(numeric) ? Math.min(MAX_TEMPLATE_ID, Math.max(1, numeric)) : ESSENTIAL_TEMPLATE_ID;
        return safe === ESSENTIAL_TEMPLATE_ID || hadPremiumTemplateAccess ? safe : ESSENTIAL_TEMPLATE_ID;
      };
      if (tenant.settings.invoicePdfTemplate !== undefined) {
        tenant.settings.invoicePdfTemplate = clampAgainstPriorAccess(tenant.settings.invoicePdfTemplate);
      }
      const contextProfiles = tenant.settings?.invoiceBranding?.contextProfiles;
      if (contextProfiles && typeof contextProfiles === 'object') {
        for (const key of Object.keys(contextProfiles)) {
          if (contextProfiles[key]?.templateId !== undefined) {
            contextProfiles[key].templateId = clampAgainstPriorAccess(contextProfiles[key].templateId);
          }
        }
      }
    }

    if (businessType || businessTypes) {
      const nextBusinessTypes = normalizeBusinessTypes(businessTypes || businessType || tenant.businessTypes || tenant.businessType);
      tenant.businessTypes = nextBusinessTypes;
      tenant.businessType = businessType && nextBusinessTypes.includes(businessType)
        ? businessType
        : getPrimaryBusinessType({ businessTypes: nextBusinessTypes, businessType: tenant.businessType });
    }

    tenant.markModified('business');
    tenant.markModified('settings');
    tenant.markModified('branding');
    tenant.markModified('businessType');
    tenant.markModified('businessTypes');
    await tenant.save();
    
    invalidateAuthCache(req.user._id, tenant._id);

    res.json(serializeAuthTenant(tenant));
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

const upload = multer({ storage: multer.memoryStorage(), fileFilter: imageFileFilter });

// @route   POST /api/tenants/upload-qr-hero
router.post('/upload-qr-hero', authorize('admin'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const tenantIdStr = String(tenantIdOf(req));
    const filename = `qrhero-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
    const key = `restaurant/${tenantIdStr}/${filename}`;

    const buffer = await sharp(req.file.buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const { url: imageUrl } = await saveUploadBuffer({
      buffer,
      key,
      contentType: 'image/webp',
      publicUrlPath: `/uploads/${key}`,
    });

    res.json({ imageUrl });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    console.error('Image processing error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// @route   POST /api/tenants/upload-qr-menu-image
router.post('/upload-qr-menu-image', authorize('admin'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const tenantIdStr = String(tenantIdOf(req));
    const filename = `qrmenu-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
    const key = `restaurant/${tenantIdStr}/${filename}`;

    const buffer = await sharp(req.file.buffer)
      .resize({ width: 2400, withoutEnlargement: true })
      .webp({ quality: 95 })
      .toBuffer();

    const { url: imageUrl } = await saveUploadBuffer({
      buffer,
      key,
      contentType: 'image/webp',
      publicUrlPath: `/uploads/${key}`,
    });

    res.json({ imageUrl });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    console.error('Image processing error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// @route   POST /api/tenants/zatca/generate-keys
router.post('/zatca/generate-keys', authorize('admin'), async (req, res) => {
  try {
    const { privateKey, publicKey } = ZatcaService.generateKeyPair();

    await Tenant.findByIdAndUpdate(tenantIdOf(req), {
      'zatca.privateKey': encryptPrivateKey(privateKey),
    });

    res.json({
      message: 'Keys generated successfully',
      publicKey,
    });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/tenants/zatca/onboard
router.post('/zatca/onboard', authorize('admin'), async (req, res) => {
  try {
    const { otp } = req.body;
    const tenant = await Tenant.findById(tenantIdOf(req));
    
    if (!tenant.zatca?.privateKey) {
      return res.status(400).json({ error: 'Generate keys first' });
    }
    
    // In production, this would call ZATCA API for compliance check
    // and exchange OTP for CSID
    
    await Tenant.findByIdAndUpdate(tenantIdOf(req), {
      'zatca.isOnboarded': true,
      'zatca.onboardedAt': new Date(),
      'zatca.deviceSerialNumber': `EGS1-${Date.now()}`
    });
    
    res.json({ message: 'ZATCA onboarding initiated', status: 'pending_verification' });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/tenants/zatca/status
router.get('/zatca/status', async (req, res) => {
  try {
    const tenant = await Tenant.findById(tenantIdOf(req))
      .select('zatca.isOnboarded zatca.onboardedAt zatca.invoiceCounter zatca.deviceSerialNumber');
    
    res.json({
      isOnboarded: tenant.zatca?.isOnboarded || false,
      onboardedAt: tenant.zatca?.onboardedAt,
      invoiceCounter: tenant.zatca?.invoiceCounter || 0,
      deviceSerialNumber: tenant.zatca?.deviceSerialNumber
    });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

router.post('/zatca/test-connection', authorize('admin'), async (req, res) => {
  try {
    const { type = 'phase1' } = req.body || {};
    const tenant = await Tenant.findById(tenantIdOf(req))
      .select('business zatca');

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const business = tenant.business || {};
    const missingFields = [];

    if (!business.legalNameEn && !business.legalNameAr) missingFields.push('legalName');
    if (!business.vatNumber) missingFields.push('vatNumber');
    if (!business.crNumber) missingFields.push('crNumber');
    if (!business.address?.city) missingFields.push('address.city');
    if (!business.address?.district) missingFields.push('address.district');
    if (!business.address?.country) missingFields.push('address.country');

    if (type === 'phase2') {
      return res.json({
        success: true,
        type,
        status: tenant.zatca?.isOnboarded ? 'connected' : 'not_connected',
        checks: {
          hasPrivateKey: Boolean(tenant.zatca?.privateKey),
          hasComplianceCsid: Boolean(tenant.zatca?.complianceCsid),
          hasProductionCsid: Boolean(tenant.zatca?.productionCsid),
          isOnboarded: Boolean(tenant.zatca?.isOnboarded),
        },
        missingFields,
      });
    }

    if (type !== 'phase1') {
      return res.status(400).json({ error: 'Unsupported test type' });
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        type,
        status: 'missing_configuration',
        error: 'Missing required company details for ZATCA Phase 1 test',
        missingFields,
      });
    }

    const sampleIssueDate = new Date();
    const sampleInvoice = {
      invoiceNumber: `PH1-TEST-${Date.now()}`,
      invoiceType: '388',
      invoiceTypeCode: '0200000',
      issueDate: sampleIssueDate,
      issueTime: sampleIssueDate.toISOString().slice(11, 19),
      currency: 'SAR',
      buyer: {
        name: 'Phase 1 Test Customer',
        address: { country: 'SA' },
      },
      totalDiscount: 0,
      taxableAmount: 100,
      totalTax: 15,
      grandTotal: 115,
      lineItems: [{
        lineNumber: 1,
        productName: 'Phase 1 Test Item',
        quantity: 1,
        unitCode: 'PCE',
        unitPrice: 100,
        lineTotal: 100,
        taxAmount: 15,
        taxRate: 15,
        lineTotalWithTax: 115,
      }],
    };

    const zatcaService = new ZatcaService();
    const xml = zatcaService.generateXML(sampleInvoice, business, true);
    const invoiceHash = zatcaService.calculateHash(xml);
    const qrCodeData = zatcaService.generateTLV({
      sellerName: business.legalNameAr || business.legalNameEn,
      vatNumber: business.vatNumber,
      timestamp: sampleIssueDate.toISOString(),
      totalWithVat: sampleInvoice.grandTotal.toFixed(2),
      vatTotal: sampleInvoice.totalTax.toFixed(2),
    });
    const qrCodeImage = await zatcaService.generateQRCode(qrCodeData);

    return res.json({
      success: true,
      type,
      status: 'ready',
      checks: {
        vatConfigured: Boolean(business.vatNumber),
        crConfigured: Boolean(business.crNumber),
        xmlGenerated: Boolean(xml),
        hashGenerated: Boolean(invoiceHash),
        qrGenerated: Boolean(qrCodeImage),
      },
      missingFields,
      sample: {
        invoiceNumber: sampleInvoice.invoiceNumber,
        invoiceHash,
        qrCodeImage,
        xmlPreview: xml.slice(0, 400),
      },
    });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

router.get('/backup', authorize('admin'), async (req, res) => {
  try {
    const tenant = await Tenant.findById(tenantIdOf(req)).lean();
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    await streamSingleTenantBackup(req, res, tenant);
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message });
    }
    res.end();
  }
});

// @route   POST /api/tenants/test-printer
// @desc    Test network printer connection via TCP
router.post('/test-printer', authorize('admin'), async (req, res) => {
  const net = await import('net');
  const { ipAddress, port } = req.body;

  if (!ipAddress || !port) {
    return res.status(400).json({ error: 'IP address and port are required' });
  }

  try {
    assertPrivatePrinterHost(ipAddress);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const socket = new net.Socket();
  const timeout = 5000;

  socket.setTimeout(timeout);

  socket.on('connect', () => {
    socket.destroy();
    res.json({ ok: true, message: `Connected to printer at ${ipAddress}:${port}` });
  });

  socket.on('timeout', () => {
    socket.destroy();
    res.status(408).json({ ok: false, error: `Connection timed out (${timeout}ms)` });
  });

  socket.on('error', (err) => {
    socket.destroy();
    res.status(502).json({ ok: false, error: `Cannot reach printer: ${err.message}` });
  });

  socket.connect(Number(port), ipAddress);
});

// @route   POST /api/tenants/test-cash-drawer
// @desc    Test cash drawer by sending kick code to network printer
router.post('/test-cash-drawer', authorize('admin'), async (req, res) => {
  const net = await import('net');
  const { ipAddress, port, kickCode } = req.body;

  if (!ipAddress || !port) {
    return res.status(400).json({ error: 'Printer IP address and port are required' });
  }

  try {
    assertPrivatePrinterHost(ipAddress);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const kickDigits = (kickCode || '27,112,0,50,250')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  if (kickDigits.length === 0) {
    return res.status(400).json({ error: 'Invalid kick code format' });
  }

  const kickBuffer = Buffer.from(kickDigits);
  const socket = new net.Socket();
  const timeout = 5000;

  socket.setTimeout(timeout);

  socket.on('connect', () => {
    socket.write(kickBuffer, () => {
      socket.end();
      res.json({ ok: true, message: `Cash drawer kick command sent to ${ipAddress}:${port}` });
    });
  });

  socket.on('timeout', () => {
    socket.destroy();
    res.status(408).json({ ok: false, error: `Connection timed out (${timeout}ms)` });
  });

  socket.on('error', (err) => {
    socket.destroy();
    res.status(502).json({ ok: false, error: `Cannot reach printer: ${err.message}` });
  });

  socket.connect(Number(port), ipAddress);
});

// @route   POST /api/tenants/test-thermal-print
// @desc    Send a test receipt to thermal printer
router.post('/test-thermal-print', authorize('admin'), async (req, res) => {
  const net = await import('net');
  const { ipAddress, port, paperWidth, encoding, businessName, businessNameAr } = req.body;

  if (!ipAddress || !port) {
    return res.status(400).json({ error: 'Printer IP address and port are required' });
  }

  try {
    assertPrivatePrinterHost(ipAddress);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const enc = encoding || 'utf8';
  const esc = '\x1B';
  const gs = '\x1D';
  const init = Buffer.from(esc + '@', 'ascii');
  const alignCenter = Buffer.from(esc + 'a' + '\x01', 'ascii');
  const alignLeft = Buffer.from(esc + 'a' + '\x00', 'ascii');
  const boldOn = Buffer.from(esc + 'E' + '\x01', 'ascii');
  const boldOff = Buffer.from(esc + 'E' + '\x00', 'ascii');
  const doubleOn = Buffer.from(gs + '!' + '\x11', 'ascii');
  const doubleOff = Buffer.from(gs + '!' + '\x00', 'ascii');
  const chars = paperWidth === 58 ? 32 : 48;
  const separator = Buffer.from('-'.repeat(chars) + '\n', 'ascii');

  const parts = [
    init,
    alignCenter,
    boldOn,
    doubleOn,
    Buffer.from((businessName || 'Maqder ERP').substring(0, 16) + '\n', enc),
    doubleOff,
    boldOff,
  ];

  if (businessNameAr) {
    parts.push(Buffer.from(businessNameAr + '\n', enc));
  }

  parts.push(
    separator,
    Buffer.from('*** TEST RECEIPT ***\n', enc),
    Buffer.from(`Date: ${new Date().toLocaleString()}\n`, enc),
    Buffer.from(`Paper: ${paperWidth || 80}mm | Cols: ${chars}\n`, enc),
    Buffer.from(`Encoding: ${enc}\n`, enc),
    separator,
    alignLeft,
    Buffer.from('Item 1                    SAR 10.00\n', enc),
    Buffer.from('Item 2                    SAR 15.00\n', enc),
    separator,
    alignCenter,
    boldOn,
    Buffer.from('Total:                   SAR 25.00\n', enc),
    boldOff,
    separator,
    Buffer.from('If you can read this,\nyour printer is working!\n\n\n', enc),
    Buffer.from(esc + 'i', 'ascii'),
  );

  const payload = Buffer.concat(parts);

  const socket = new net.Socket();
  const timeout = 5000;

  socket.setTimeout(timeout);

  socket.on('connect', () => {
    socket.write(payload, () => {
      socket.end();
      res.json({ ok: true, message: `Test receipt sent to ${ipAddress}:${port}` });
    });
  });

  socket.on('timeout', () => {
    socket.destroy();
    res.status(408).json({ ok: false, error: `Connection timed out (${timeout}ms)` });
  });

  socket.on('error', (err) => {
    socket.destroy();
    res.status(502).json({ ok: false, error: `Cannot reach printer: ${err.message}` });
  });

  socket.connect(Number(port), ipAddress);
});

// @route   POST /api/tenants/print-receipt
// @desc    Print a receipt via ESC/POS to network printer (and optionally open cash drawer)
router.post('/print-receipt', authorize('admin'), async (req, res) => {
  const net = await import('net');
  const { ipAddress, port, receipt, openCashDrawer, kickCode, encoding, paperWidth, cutAtEnd } = req.body;

  if (!ipAddress || !port) {
    return res.status(400).json({ error: 'Printer IP address and port are required' });
  }

  try {
    assertPrivatePrinterHost(ipAddress);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const enc = encoding || 'utf8';
  const esc = '\x1B';
  const chars = paperWidth === 58 ? 32 : 48;

  // Build ESC/POS payload
  const parts = [];

  // Init printer
  parts.push(Buffer.from(esc + '@', 'ascii'));

  // Print receipt lines if provided
  if (receipt && Array.isArray(receipt.lines)) {
    for (const line of receipt.lines) {
      if (line.type === 'center') {
        parts.push(Buffer.from(esc + 'a' + '\x01', 'ascii')); // align center
      } else if (line.type === 'right') {
        parts.push(Buffer.from(esc + 'a' + '\x02', 'ascii')); // align right
      } else {
        parts.push(Buffer.from(esc + 'a' + '\x00', 'ascii')); // align left
      }
      if (line.bold) {
        parts.push(Buffer.from(esc + 'E' + '\x01', 'ascii')); // bold on
      }
      if (line.size === 'double') {
        parts.push(Buffer.from(esc + '!' + '\x10', 'ascii')); // double width+height
      }
      parts.push(Buffer.from((line.text || '') + '\n', enc));
      if (line.bold || line.size === 'double') {
        parts.push(Buffer.from(esc + 'E' + '\x00', 'ascii')); // bold off
        parts.push(Buffer.from(esc + '!' + '\x00', 'ascii')); // normal size
      }
    }
    // Reset alignment
    parts.push(Buffer.from(esc + 'a' + '\x00', 'ascii'));
  }

  // Open cash drawer if requested
  if (openCashDrawer) {
    const kickDigits = (kickCode || '27,112,0,50,250')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    if (kickDigits.length > 0) {
      parts.push(Buffer.from(kickDigits));
    }
  }

  // Paper cut
  if (cutAtEnd !== false) {
    parts.push(Buffer.from(esc + 'i', 'ascii')); // full cut
  }

  const payload = Buffer.concat(parts);

  const socket = new net.Socket();
  const timeout = 5000;

  socket.setTimeout(timeout);

  socket.on('connect', () => {
    socket.write(payload, () => {
      socket.end();
      res.json({ ok: true, message: `Receipt sent to ${ipAddress}:${port}${openCashDrawer ? ' + cash drawer opened' : ''}` });
    });
  });

  socket.on('timeout', () => {
    socket.destroy();
    res.status(408).json({ ok: false, error: `Connection timed out (${timeout}ms)` });
  });

  socket.on('error', (err) => {
    socket.destroy();
    res.status(502).json({ ok: false, error: `Cannot reach printer: ${err.message}` });
  });

  socket.connect(Number(port), ipAddress);
});

export default router;
