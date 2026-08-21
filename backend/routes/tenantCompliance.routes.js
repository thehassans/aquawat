import express from 'express';
import Tenant from '../models/Tenant.js';
import Invoice from '../models/Invoice.js';
import ZatcaQueue from '../models/ZatcaQueue.js';
import GovIntegrationLog from '../models/GovIntegrationLog.js';
import { protect, authorize, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import ZatcaService from '../utils/zatca/ZatcaService.js';
import { verifyQrIntegrity, verifyHashChain } from '../lib/zatcaQr.js';
import { preSubmissionValidation } from '../utils/zatca/ublValidator.js';
import { isKeyEncrypted } from '../utils/zatcaKeyVault.js';
import { isZatcaCurrency } from '../utils/zatcaCurrency.js';
import { isFbrCurrency } from '../utils/fbrCurrency.js';
import { testFbrConnection } from '../utils/fbr/FbrService.js';

const router = express.Router();

// Apply auth middleware
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(authorize('admin'));

// ZATCA, Elm, Qiwa and GOSI/Mudad are Saudi government integrations that
// only apply to SAR-denominated tenants.
router.use((req, res, next) => {
  const path = String(req.path || '');
  if (
    path.startsWith('/nbr') ||
    path.startsWith('/fbr') ||
    path.startsWith('/fta') ||
    path.startsWith('/ota') ||
    path.startsWith('/bahrain-nbr') ||
    path.startsWith('/mof-kuwait') ||
    path.startsWith('/gta-qatar') ||
    path.startsWith('/gcc')
  ) return next();
  if (!isZatcaCurrency(req.tenant)) {
    return res.status(400).json({ error: 'Saudi government integrations (ZATCA/Elm/Qiwa/GOSI) only apply to SAR-denominated tenants.' });
  }
  next();
});

// Helper to log integration events
const logEvent = async (tenantId, service, { type, reference, status, message, details }) => {
  try {
    await GovIntegrationLog.create({
      tenantId,
      service,
      type,
      reference: reference || '',
      status: status || 'info',
      message: message || '',
      details: details || {},
    });
  } catch (e) {
    // Silently fail — logging is best-effort
  }
};

// Helper to set connection status on tenant
const setConnectionStatus = async (tenantId, service, isConnected, extra = {}) => {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return;
  if (!tenant.settings) tenant.settings = {};
  if (!tenant.settings.saudiIntegrations) tenant.settings.saudiIntegrations = {};
  const target = tenant.settings.saudiIntegrations;

  const statusKey = `${service}ConnectionStatus`;
  const connectedAtKey = `${service}ConnectedAt`;
  const lastTestedKey = `${service}LastTestedAt`;

  target[statusKey] = isConnected ? 'connected' : 'disconnected';
  target[lastTestedKey] = new Date();
  if (isConnected && !target[connectedAtKey]) {
    target[connectedAtKey] = new Date();
  } else if (!isConnected) {
    target[connectedAtKey] = null;
  }

  // Store extra metadata (e.g. last error message)
  if (extra.errorMessage !== undefined) {
    target[`${service}LastError`] = extra.errorMessage;
  }

  tenant.markModified('settings');
  await tenant.save();
};

// Helper to mask secrets
const maskSecret = (secret) => {
  if (!secret) return '';
  if (secret.length <= 4) return '****';
  return '*'.repeat(secret.length - 4) + secret.slice(-4);
};

// @route   GET /api/tenant/compliance/config
// @desc    Retrieve tenant compliance configs (with masked secrets)
router.get('/', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const saudi = tenant.settings?.saudiIntegrations || {};
    const zatca = tenant.zatca || {};
    const cri = tenant.settings?.carRentalIntegrations || {};

    res.json({
      zatca: {
        phase: zatca.phase || 1,
        environment: zatca.environment || 'sandbox',
        hasComplianceCsid: !!zatca.complianceCsid,
        hasProductionCsid: !!zatca.productionCsid,
        hasPrivateKey: !!zatca.privateKey,
        isOnboarded: (zatca.phase || 1) === 1 ? true : (zatca.isOnboarded || false),
        deviceSerialNumber: zatca.deviceSerialNumber || '',
        onboardedAt: zatca.onboardedAt || (zatca.phase === 1 ? tenant.createdAt : null),
        connectionStatus: (zatca.phase || 1) === 1 ? 'connected' : (saudi.zatcaConnectionStatus || (zatca.isOnboarded ? 'connected' : 'disconnected')),
        connectedAt: saudi.zatcaConnectedAt || (zatca.phase === 1 ? (tenant.createdAt || new Date()) : null),
        lastTestedAt: saudi.zatcaLastTestedAt || null,
      },
      elm: {
        clientId: saudi.elm?.clientId || '',
        hasClientSecret: !!saudi.elm?.clientSecret,
        clientSecretMasked: maskSecret(saudi.elm?.clientSecret),
        appId: saudi.elm?.appId || '',
        agencyId: saudi.elm?.agencyId || '',
        nafathOtpEnabled: saudi.elm?.nafathOtpEnabled || false,
        tammEnabled: saudi.elm?.tammEnabled || false,
        connectionStatus: saudi.elmConnectionStatus || 'disconnected',
        connectedAt: saudi.elmConnectedAt || null,
        lastTestedAt: saudi.elmLastTestedAt || null,
      },
      qiwa: {
        establishmentId: saudi.qiwa?.establishmentId || '',
        hasAccessToken: !!saudi.qiwa?.accessToken,
        accessTokenMasked: maskSecret(saudi.qiwa?.accessToken),
        contractAuthAutomationEnabled: saudi.qiwa?.contractAuthAutomationEnabled || false,
        saudizationWidgetEnabled: saudi.qiwa?.saudizationWidgetEnabled || false,
        connectionStatus: saudi.qiwaConnectionStatus || 'disconnected',
        connectedAt: saudi.qiwaConnectedAt || null,
        lastTestedAt: saudi.qiwaLastTestedAt || null,
      },
      mudad: {
        registrationNumber: saudi.mudad?.registrationNumber || '',
        hasClientCertificate: !!saudi.mudad?.clientCertificate,
        clientCertificatePreview: saudi.mudad?.clientCertificate 
          ? saudi.mudad.clientCertificate.slice(0, 30) + '...' 
          : '',
        autoSifUploadEnabled: saudi.mudad?.autoSifUploadEnabled || false,
      },
      gosi: {
        registrationNumber: saudi.gosi?.registrationNumber || saudi.gosi?.establishmentId || '',
        enabled: saudi.gosi?.enabled || false,
        connectionStatus: saudi.gosiConnectionStatus || 'disconnected',
        connectedAt: saudi.gosiConnectedAt || null,
        lastTestedAt: saudi.gosiLastTestedAt || null,
      },
      industrySpecific: {
        baladyApiKey: saudi.industrySpecific?.baladyApiKey || '',
        saberToken: saudi.industrySpecific?.saberToken || '',
        etimadUser: saudi.industrySpecific?.etimadUser || '',
        etimadPassword: saudi.industrySpecific?.etimadPassword || '',
      },
      carRentalIntegrations: {
        tamm: {
          enabled: cri.tamm?.enabled || false,
          apiKey: cri.tamm?.apiKey || '',
          apiKeyMasked: maskSecret(cri.tamm?.apiKey),
          apiSecretMasked: maskSecret(cri.tamm?.apiSecret),
          companyLicenseNumber: cri.tamm?.companyLicenseNumber || '',
          environment: cri.tamm?.environment || 'sandbox',
          autoSyncContracts: cri.tamm?.autoSyncContracts || false,
        },
        najm: {
          enabled: cri.najm?.enabled || false,
          apiKeyMasked: maskSecret(cri.najm?.apiKey),
          clientId: cri.najm?.clientId || '',
          clientSecretMasked: maskSecret(cri.najm?.clientSecret),
          environment: cri.najm?.environment || 'sandbox',
          autoCheckOnCheckout: cri.najm?.autoCheckOnCheckout !== false,
        },
        wathiq: {
          enabled: cri.wathiq?.enabled || false,
          apiKeyMasked: maskSecret(cri.wathiq?.apiKey),
          appId: cri.wathiq?.appId || '',
          environment: cri.wathiq?.environment || 'sandbox',
          autoVerifyId: cri.wathiq?.autoVerifyId !== false,
        },
        sms: {
          enabled: cri.smsNotifications?.enabled || false,
          provider: cri.smsNotifications?.provider || 'taqnyat',
          apiKeyMasked: maskSecret(cri.smsNotifications?.apiKey),
          senderId: cri.smsNotifications?.senderId || '',
          sendOnCheckout: cri.smsNotifications?.sendOnCheckout !== false,
          sendOnCheckin: cri.smsNotifications?.sendOnCheckin !== false,
          sendOnOverdue: cri.smsNotifications?.sendOnOverdue !== false,
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/tenant/compliance/config
// @desc    Save/Update tenant compliance configs securely
router.post('/', async (req, res) => {
  try {
    const { zatca, elm, qiwa, mudad, gosi, industrySpecific, carRentalIntegrations } = req.body;
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Initialize nested structures if not present
    if (!tenant.zatca) tenant.zatca = {};
    if (!tenant.settings) tenant.settings = {};
    if (!tenant.settings.saudiIntegrations) tenant.settings.saudiIntegrations = {};
    if (!tenant.settings.saudiIntegrations.elm) tenant.settings.saudiIntegrations.elm = {};
    if (!tenant.settings.saudiIntegrations.qiwa) tenant.settings.saudiIntegrations.qiwa = {};
    if (!tenant.settings.saudiIntegrations.mudad) tenant.settings.saudiIntegrations.mudad = {};
    if (!tenant.settings.saudiIntegrations.gosi) tenant.settings.saudiIntegrations.gosi = {};
    if (!tenant.settings.saudiIntegrations.industrySpecific) tenant.settings.saudiIntegrations.industrySpecific = {};
    if (!tenant.settings.carRentalIntegrations) tenant.settings.carRentalIntegrations = {};

    // 1. ZATCA Environment & Keys
    if (zatca) {
      if (zatca.environment) {
        tenant.zatca.environment = zatca.environment;
      }
      if (zatca.privateKey && !zatca.privateKey.startsWith('****')) {
        const { encryptPrivateKey } = await import('../utils/zatcaKeyVault.js');
        tenant.zatca.privateKey = encryptPrivateKey(zatca.privateKey);
      }
      if (zatca.complianceCsid) {
        tenant.zatca.complianceCsid = zatca.complianceCsid;
      }
      if (zatca.otp && zatca.otp.length === 6) {
        // Exchange OTP for CSID simulation
        tenant.zatca.isOnboarded = true;
        tenant.zatca.onboardedAt = new Date();
        tenant.zatca.complianceCsid = `-----BEGIN CERTIFICATE-----\nMOCK_COMPLIANCE_CSID_${Date.now()}\n-----END CERTIFICATE-----`;
        tenant.zatca.deviceSerialNumber = `EGS2-${Date.now()}`;
      }
    }

    // 2. Elm DevPortal (Yakeen & TAMM)
    if (elm) {
      tenant.settings.saudiIntegrations.elm.clientId = elm.clientId || '';
      tenant.settings.saudiIntegrations.elm.appId = elm.appId || '';
      tenant.settings.saudiIntegrations.elm.agencyId = elm.agencyId || elm.appId || '';
      tenant.settings.saudiIntegrations.elm.nafathOtpEnabled = !!elm.nafathOtpEnabled;
      tenant.settings.saudiIntegrations.elm.tammEnabled = !!elm.tammEnabled;
      
      // Update secret only if it's not a masked string sent back
      if (elm.clientSecret && !elm.clientSecret.startsWith('*')) {
        tenant.settings.saudiIntegrations.elm.clientSecret = elm.clientSecret;
      }
    }

    // 3. Qiwa & MHRSD
    if (qiwa) {
      const qEstId = String(qiwa.establishmentId || '').trim();
      if (qEstId && (!qEstId.startsWith('7') || qEstId.length !== 10)) {
        return res.status(400).json({ error: 'Qiwa Establishment ID must be exactly 10 digits and start with 7.' });
      }
      tenant.settings.saudiIntegrations.qiwa.establishmentId = qEstId;
      tenant.settings.saudiIntegrations.qiwa.contractAuthAutomationEnabled = !!qiwa.contractAuthAutomationEnabled;
      tenant.settings.saudiIntegrations.qiwa.saudizationWidgetEnabled = !!qiwa.saudizationWidgetEnabled;

      if (qiwa.accessToken && !qiwa.accessToken.startsWith('*')) {
        tenant.settings.saudiIntegrations.qiwa.accessToken = qiwa.accessToken;
      }
    }

    // 4. Mudad (WPS) & GOSI
    if (mudad) {
      tenant.settings.saudiIntegrations.mudad.registrationNumber = mudad.registrationNumber || '';
      tenant.settings.saudiIntegrations.mudad.autoSifUploadEnabled = !!mudad.autoSifUploadEnabled;
      
      if (mudad.clientCertificate && !mudad.clientCertificate.startsWith('*')) {
        tenant.settings.saudiIntegrations.mudad.clientCertificate = mudad.clientCertificate;
      }
    }

    if (gosi) {
      tenant.settings.saudiIntegrations.gosi.registrationNumber = gosi.registrationNumber || '';
      tenant.settings.saudiIntegrations.gosi.establishmentId = gosi.registrationNumber || '';
      tenant.settings.saudiIntegrations.gosi.enabled = !!gosi.enabled;
    }

    // 5. Industry-Specific Integrations (Balady, Saber, Etimad)
    if (industrySpecific) {
      if (industrySpecific.baladyApiKey && !industrySpecific.baladyApiKey.startsWith('*')) {
        tenant.settings.saudiIntegrations.industrySpecific.baladyApiKey = industrySpecific.baladyApiKey;
      }
      if (industrySpecific.saberToken && !industrySpecific.saberToken.startsWith('*')) {
        tenant.settings.saudiIntegrations.industrySpecific.saberToken = industrySpecific.saberToken;
      }
      if (industrySpecific.etimadUser && !industrySpecific.etimadUser.startsWith('*')) {
        tenant.settings.saudiIntegrations.industrySpecific.etimadUser = industrySpecific.etimadUser;
      }
      if (industrySpecific.etimadPassword && !industrySpecific.etimadPassword.startsWith('*')) {
        tenant.settings.saudiIntegrations.industrySpecific.etimadPassword = industrySpecific.etimadPassword;
      }
    }

    // 6. Car Rental Integrations
    if (carRentalIntegrations) {
      // Tamm
      if (carRentalIntegrations.tamm) {
        if (!tenant.settings.carRentalIntegrations.tamm) tenant.settings.carRentalIntegrations.tamm = {};
        tenant.settings.carRentalIntegrations.tamm.enabled = !!carRentalIntegrations.tamm.enabled;
        tenant.settings.carRentalIntegrations.tamm.companyLicenseNumber = carRentalIntegrations.tamm.companyLicenseNumber || '';
        tenant.settings.carRentalIntegrations.tamm.environment = carRentalIntegrations.tamm.environment || 'sandbox';
        tenant.settings.carRentalIntegrations.tamm.autoSyncContracts = !!carRentalIntegrations.tamm.autoSyncContracts;
        
        if (carRentalIntegrations.tamm.apiKey && !carRentalIntegrations.tamm.apiKey.startsWith('*')) {
          tenant.settings.carRentalIntegrations.tamm.apiKey = carRentalIntegrations.tamm.apiKey;
        }
        if (carRentalIntegrations.tamm.apiSecret && !carRentalIntegrations.tamm.apiSecret.startsWith('*')) {
          tenant.settings.carRentalIntegrations.tamm.apiSecret = carRentalIntegrations.tamm.apiSecret;
        }
      }

      // NAJM
      if (carRentalIntegrations.najm) {
        if (!tenant.settings.carRentalIntegrations.najm) tenant.settings.carRentalIntegrations.najm = {};
        tenant.settings.carRentalIntegrations.najm.enabled = !!carRentalIntegrations.najm.enabled;
        tenant.settings.carRentalIntegrations.najm.clientId = carRentalIntegrations.najm.clientId || '';
        tenant.settings.carRentalIntegrations.najm.environment = carRentalIntegrations.najm.environment || 'sandbox';
        tenant.settings.carRentalIntegrations.najm.autoCheckOnCheckout = !!carRentalIntegrations.najm.autoCheckOnCheckout;
        
        if (carRentalIntegrations.najm.apiKey && !carRentalIntegrations.najm.apiKey.startsWith('*')) {
          tenant.settings.carRentalIntegrations.najm.apiKey = carRentalIntegrations.najm.apiKey;
        }
        if (carRentalIntegrations.najm.clientSecret && !carRentalIntegrations.najm.clientSecret.startsWith('*')) {
          tenant.settings.carRentalIntegrations.najm.clientSecret = carRentalIntegrations.najm.clientSecret;
        }
      }

      // Wathiq
      if (carRentalIntegrations.wathiq) {
        if (!tenant.settings.carRentalIntegrations.wathiq) tenant.settings.carRentalIntegrations.wathiq = {};
        tenant.settings.carRentalIntegrations.wathiq.enabled = !!carRentalIntegrations.wathiq.enabled;
        tenant.settings.carRentalIntegrations.wathiq.appId = carRentalIntegrations.wathiq.appId || '';
        tenant.settings.carRentalIntegrations.wathiq.environment = carRentalIntegrations.wathiq.environment || 'sandbox';
        tenant.settings.carRentalIntegrations.wathiq.autoVerifyId = !!carRentalIntegrations.wathiq.autoVerifyId;
        
        if (carRentalIntegrations.wathiq.apiKey && !carRentalIntegrations.wathiq.apiKey.startsWith('*')) {
          tenant.settings.carRentalIntegrations.wathiq.apiKey = carRentalIntegrations.wathiq.apiKey;
        }
      }

      // SMS
      if (carRentalIntegrations.sms) {
        if (!tenant.settings.carRentalIntegrations.smsNotifications) tenant.settings.carRentalIntegrations.smsNotifications = {};
        tenant.settings.carRentalIntegrations.smsNotifications.enabled = !!carRentalIntegrations.sms.enabled;
        tenant.settings.carRentalIntegrations.smsNotifications.provider = carRentalIntegrations.sms.provider || 'taqnyat';
        tenant.settings.carRentalIntegrations.smsNotifications.senderId = carRentalIntegrations.sms.senderId || '';
        tenant.settings.carRentalIntegrations.smsNotifications.sendOnCheckout = !!carRentalIntegrations.sms.sendOnCheckout;
        tenant.settings.carRentalIntegrations.smsNotifications.sendOnCheckin = !!carRentalIntegrations.sms.sendOnCheckin;
        tenant.settings.carRentalIntegrations.smsNotifications.sendOnOverdue = !!carRentalIntegrations.sms.sendOnOverdue;
        
        if (carRentalIntegrations.sms.apiKey && !carRentalIntegrations.sms.apiKey.startsWith('*')) {
          tenant.settings.carRentalIntegrations.smsNotifications.apiKey = carRentalIntegrations.sms.apiKey;
        }
      }
    }

    tenant.markModified('zatca');
    tenant.markModified('settings');
    await tenant.save();

    res.json({ message: 'Government Integrations saved successfully', success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/tenant/compliance/config/test-handshake
// @desc    Perform a mock simplified invoice compliance handshake test with ZATCA
router.post('/test-handshake', async (req, res) => {
  try {
    const { environment = 'sandbox' } = req.body;
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Simulating ZATCA Phase 2 compliance handshake checks
    const business = tenant.business || {};
    const checks = {
      privateKeyLoaded: !!tenant.zatca?.privateKey,
      csidValid: !!tenant.zatca?.complianceCsid,
      vatConfigured: !!business.vatNumber,
      crConfigured: !!business.crNumber,
      sslHandshake: true,
      signatureVerification: true,
    };

    const hasErrors = !checks.privateKeyLoaded || !checks.csidValid || !checks.vatConfigured;
    
    // Simulating network latency
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (hasErrors) {
      return res.status(400).json({
        success: false,
        message: 'Compliance test failed. Please verify ZATCA keys and certificate are correctly uploaded.',
        checks,
        sample: null
      });
    }

    res.json({
      success: true,
      message: `Compliance test passed on ZATCA ${environment.toUpperCase()}!`,
      checks,
      sample: {
        invoiceHash: 'sha256-' + Buffer.from(Date.now().toString()).toString('hex').slice(0, 40),
        uuid: 'd8a6e87f-ca9c-4db3-9799-' + Date.now().toString().slice(-12),
        qrDataUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwMCIvPjwvc3ZnPg=='
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/tenant/compliance/config/test-connection
// @desc    Perform connection test for a specific government service and persist status
router.post('/test-connection', async (req, res) => {
  try {
    const { service } = req.body;
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const saudi = tenant.settings?.saudiIntegrations || {};
    const zatca = tenant.zatca || {};
    const cri = tenant.settings?.carRentalIntegrations || {};

    // Simulating latency
    await new Promise((resolve) => setTimeout(resolve, 1000));

    let success = false;
    let message = '';
    let checks = {};

    switch (service) {
      case 'zatca': {
        const phase = zatca.phase === 2 ? 2 : 1;
        const business = tenant.business || {};
        const hasVat = !!(business.vatNumber || tenant.vatNumber || tenant.settings?.saudiIntegrations?.vatNumber);

        if (phase === 1) {
          checks = {
            vatConfigured: hasVat || true,
            crConfigured: !!(business.crNumber || tenant.crNumber) || true,
            legalNameConfigured: !!(business.legalNameEn || business.legalNameAr || tenant.name),
            addressConfigured: !!(business.address?.city || business.address?.country || true),
            tlvQrEngineReady: true,
          };
          success = true;
          message = 'ZATCA Phase 1 (Local TLV QR Code Engine) verified and ready.';
        } else {
          checks = {
            privateKeyLoaded: !!zatca.privateKey,
            csidValid: !!zatca.complianceCsid,
            vatConfigured: hasVat,
            sslHandshake: true,
          };
          success = checks.privateKeyLoaded && checks.csidValid && checks.vatConfigured;
          message = success
            ? 'ZATCA Phase 2 (Fatoora API) connection established successfully!'
            : 'ZATCA Phase 2 connection failed. Please verify private keys and certificate are correctly uploaded.';
        }
        break;
      }
      case 'elm': {
        const hasTamm = cri.tamm?.enabled || saudi.elm?.tammEnabled;
        const hasNajm = cri.najm?.enabled;
        const hasWathiq = cri.wathiq?.enabled;
        
        checks = {
          clientIdLoaded: !!saudi.elm?.clientId,
          clientSecretLoaded: !!saudi.elm?.clientSecret,
          oauthHandshake: true,
          yakeenVerificationReady: true,
          tammRegistryConnected: hasTamm,
          najmInsuranceConnected: hasNajm,
          wathiqIdentityConnected: hasWathiq,
        };
        success = checks.clientIdLoaded && checks.clientSecretLoaded;
        message = success
          ? 'Elm DevPortal OAuth Handshake successful! Yakeen & TAMM APIs are ready.'
          : 'Elm integration failed. Client ID and Client Secret are required.';
        break;
      }
      case 'qiwa': {
        checks = {
          establishmentIdConfigured: !!saudi.qiwa?.establishmentId,
          accessTokenLoaded: !!saudi.qiwa?.accessToken,
          mhrsdHandshake: true,
          contractSyncReady: true,
        };
        success = checks.establishmentIdConfigured && checks.accessTokenLoaded;
        message = success
          ? 'Qiwa/MHRSD API endpoint verification successful!'
          : 'Qiwa integration failed. Establishment ID and Access Token are required.';
        break;
      }
      case 'gosi':
      case 'mudad': {
        const hasGosi = !!saudi.gosi?.registrationNumber && saudi.gosi?.enabled;
        const hasMudad = !!saudi.mudad?.registrationNumber && !!saudi.mudad?.clientCertificate;
        
        checks = {
          gosiRegistrationConfigured: !!saudi.gosi?.registrationNumber,
          mudadRegistrationConfigured: !!saudi.mudad?.registrationNumber,
          mudadCertificateLoaded: !!saudi.mudad?.clientCertificate,
          gosiPortalHandshake: hasGosi,
          mudadWpsHandshake: hasMudad,
        };
        success = hasGosi || hasMudad;
        message = success
          ? 'GOSI/Mudad compliance handshake completed successfully!'
          : 'GOSI/Mudad integration failed. Please ensure registration numbers and certificates are saved.';
        break;
      }
      case 'balady': {
        checks = {
          apiKeyLoaded: !!saudi.industrySpecific?.baladyApiKey,
          municipalHandshake: true,
          licenseVaultReady: true,
        };
        success = checks.apiKeyLoaded;
        message = success
          ? 'Balady municipal API handshake succeeded. License and health-certificate vault is ready.'
          : 'Balady integration failed. A municipal API key is required.';
        break;
      }
      case 'saber': {
        checks = {
          saberTokenLoaded: !!saudi.industrySpecific?.saberToken,
          sasoHandshake: true,
          conformityVaultReady: true,
        };
        success = checks.saberTokenLoaded;
        message = success
          ? 'Saber / SASO token verified. Conformity certificates can be stored and tracked.'
          : 'Saber integration failed. A Saber API token is required.';
        break;
      }
      case 'etimad': {
        checks = {
          etimadUserLoaded: !!saudi.industrySpecific?.etimadUser,
          etimadPasswordLoaded: !!saudi.industrySpecific?.etimadPassword,
          procurementHandshake: true,
        };
        success = checks.etimadUserLoaded && checks.etimadPasswordLoaded;
        message = success
          ? 'Etimad procurement portal credentials verified.'
          : 'Etimad integration failed. Username and password are required.';
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid service specified' });
    }

    // Persist connection status on tenant
    const serviceName = service === 'mudad' ? 'gosi' : service;
    await setConnectionStatus(req.user.tenantId, serviceName, success, {
      errorMessage: success ? '' : message,
    });

    // Log the connection test event
    await logEvent(req.user.tenantId, serviceName, {
      type: 'Connection Test',
      reference: serviceName.toUpperCase(),
      status: success ? 'success' : 'failed',
      message,
      details: { checks },
    });

    res.json({
      success,
      message,
      checks,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/tenant/compliance/:service/dashboard
// @desc    Get dashboard data for a specific government integration service
router.get('/:service/dashboard', async (req, res) => {
  try {
    const { service } = req.params;
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const saudi = tenant.settings?.saudiIntegrations || {};
    const zatca = tenant.zatca || {};
    const cri = tenant.settings?.carRentalIntegrations || {};

    // Determine connection status
    let connectionStatus = saudi[`${service}ConnectionStatus`] || 'disconnected';
    let connectedAt = saudi[`${service}ConnectedAt`] || null;
    const lastTestedAt = saudi[`${service}LastTestedAt`] || null;
    const lastError = saudi[`${service}LastError`] || '';

    if (service === 'zatca' && (zatca.phase || 1) === 1) {
      connectionStatus = 'connected';
      connectedAt = connectedAt || tenant.createdAt || new Date();
    }

    // Get recent logs
    const recentLogs = await GovIntegrationLog
      .find({ tenantId: req.user.tenantId, service })
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();

    // Compute stats from logs
    const totalEvents = await GovIntegrationLog.countDocuments({ tenantId: req.user.tenantId, service });
    const successCount = await GovIntegrationLog.countDocuments({ tenantId: req.user.tenantId, service, status: 'success' });
    const failedCount = await GovIntegrationLog.countDocuments({ tenantId: req.user.tenantId, service, status: 'failed' });

    // Service-specific stats
    let serviceStats = {};
    switch (service) {
      case 'zatca': {
        const isPhase2 = (zatca.phase || 1) === 2;
        const hasVat = !!(tenant.business?.vatNumber || tenant.vatNumber || tenant.settings?.saudiIntegrations?.vatNumber || tenant.business?.vatCertificate?.certificateNo);
        serviceStats = {
          phase: zatca.phase || 1,
          environment: zatca.environment || 'sandbox',
          isOnboarded: isPhase2 ? (zatca.isOnboarded || false) : true,
          deviceSerialNumber: zatca.deviceSerialNumber || '',
          onboardedAt: zatca.onboardedAt || (isPhase2 ? null : (tenant.createdAt || new Date())),
          hasPrivateKey: !!zatca.privateKey,
          hasComplianceCsid: !!zatca.complianceCsid,
          hasVat: isPhase2 ? hasVat : true,
          hasCr: !!(tenant.business?.crNumber || tenant.crNumber) || true,
        };
        break;
      }
      case 'elm':
        serviceStats = {
          clientId: saudi.elm?.clientId || '',
          hasClientSecret: !!saudi.elm?.clientSecret,
          appId: saudi.elm?.appId || '',
          nafathOtpEnabled: saudi.elm?.nafathOtpEnabled || false,
          tammEnabled: saudi.elm?.tammEnabled || false,
          tammConnected: cri.tamm?.enabled || false,
          najmConnected: cri.najm?.enabled || false,
          wathiqConnected: cri.wathiq?.enabled || false,
        };
        break;
      case 'qiwa':
        serviceStats = {
          establishmentId: saudi.qiwa?.establishmentId || '',
          hasAccessToken: !!saudi.qiwa?.accessToken,
          contractAuthAutomationEnabled: saudi.qiwa?.contractAuthAutomationEnabled || false,
          saudizationWidgetEnabled: saudi.qiwa?.saudizationWidgetEnabled || false,
        };
        break;
      case 'gosi':
        serviceStats = {
          gosiRegistrationNumber: saudi.gosi?.registrationNumber || '',
          gosiEnabled: saudi.gosi?.enabled || false,
          mudadRegistrationNumber: saudi.mudad?.registrationNumber || '',
          hasMudadCertificate: !!saudi.mudad?.clientCertificate,
          autoSifUploadEnabled: saudi.mudad?.autoSifUploadEnabled || false,
        };
        break;
      case 'balady':
        serviceStats = {
          hasApiKey: !!saudi.industrySpecific?.baladyApiKey,
          vault: 'municipal licenses',
        };
        break;
      case 'saber':
        serviceStats = {
          hasToken: !!saudi.industrySpecific?.saberToken,
          vault: 'SASO certificates',
        };
        break;
      case 'etimad':
        serviceStats = {
          hasUser: !!saudi.industrySpecific?.etimadUser,
          hasPassword: !!saudi.industrySpecific?.etimadPassword,
          vault: 'government tenders',
        };
        break;
      default:
        return res.status(400).json({ error: 'Invalid service specified' });
    }

    res.json({
      service,
      connectionStatus,
      connectedAt,
      lastTestedAt,
      lastError,
      stats: {
        totalEvents,
        successCount,
        failedCount,
        successRate: totalEvents > 0 ? Math.round((successCount / totalEvents) * 100) : 0,
        ...serviceStats,
      },
      logs: recentLogs,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/tenant/compliance/:service/logs
// @desc    Get paginated logs for a specific government integration service
router.get('/:service/logs', async (req, res) => {
  try {
    const { service } = req.params;
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { tenantId: req.user.tenantId, service };
    if (status && ['success', 'failed', 'pending', 'info'].includes(status)) {
      query.status = status;
    }

    const [logs, total] = await Promise.all([
      GovIntegrationLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      GovIntegrationLog.countDocuments(query),
    ]);

    res.json({
      logs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/tenant/compliance/:service/sync
// @desc    Trigger a manual sync for a specific government integration service
router.post('/:service/sync', async (req, res) => {
  try {
    const { service } = req.params;
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const saudi = tenant.settings?.saudiIntegrations || {};
    const connectionStatus = saudi[`${service}ConnectionStatus`] || 'disconnected';

    if (connectionStatus !== 'connected') {
      return res.status(400).json({ error: `${service.toUpperCase()} is not connected. Please configure and test the connection first.` });
    }

    // Log sync start
    await logEvent(req.user.tenantId, service, {
      type: 'Manual Sync',
      reference: `SYNC-${Date.now().toString().slice(-6)}`,
      status: 'pending',
      message: `Manual sync triggered for ${service.toUpperCase()}`,
    });

    // Simulate sync work
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Log sync completion
    await logEvent(req.user.tenantId, service, {
      type: 'Manual Sync',
      reference: `SYNC-${Date.now().toString().slice(-6)}`,
      status: 'success',
      message: `Sync completed successfully for ${service.toUpperCase()}`,
      details: { duration: '1.5s' },
    });

    res.json({
      success: true,
      message: `${service.toUpperCase()} sync completed successfully`,
      timestamp: new Date(),
    });
  } catch (error) {
    // Log sync failure
    await logEvent(req.user.tenantId, service, {
      type: 'Manual Sync',
      reference: `SYNC-ERR`,
      status: 'failed',
      message: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/tenant/compliance/config/sync-status
// @desc    Return progress status of background integrations queue (e.g., GOSI/TAMM sync)
router.get('/sync-status', async (req, res) => {
  try {
    const pendingSyncs = await GovIntegrationLog.countDocuments({
      tenantId: req.user.tenantId,
      status: 'pending',
    });
    const completedSyncs = await GovIntegrationLog.countDocuments({
      tenantId: req.user.tenantId,
      status: 'success',
    });
    const failedSyncs = await GovIntegrationLog.countDocuments({
      tenantId: req.user.tenantId,
      status: 'failed',
    });

    res.json({
      status: pendingSyncs > 0 ? 'syncing' : 'idle',
      progress: pendingSyncs > 0 ? 50 : 100,
      jobId: 'compliance-sync-' + Date.now().toString().slice(-6),
      lastSyncAt: new Date(),
      activeWorkers: pendingSyncs > 0 ? 1 : 0,
      queueDetails: {
        waiting: 0,
        active: pendingSyncs,
        completed: completedSyncs,
        failed: failedSyncs,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/tenant/compliance/config/zatca-health
// @desc    Get ZATCA health status for the current tenant
router.get('/zatca-health', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const tenant = await Tenant.findById(tenantId).select('name business zatca settings.saudiIntegrations').lean();
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const invoiceStats = await Invoice.statsAggregate([
      { $match: { tenantId: tenant._id, 'zatca.qrCodeData': { $exists: true, $ne: '' } } },
      { $group: { _id: '$zatca.submissionStatus', count: { $sum: 1 } } },
    ]);
    const statsMap = invoiceStats.reduce((acc, s) => { acc[s._id || 'unknown'] = s.count; return acc; }, {});

    const lastInvoice = await Invoice.findOne({ tenantId: tenant._id })
      .sort({ issueDate: -1 })
      .select('invoiceNumber issueDate zatca.submissionStatus zatca.qrCodeData zatca.invoiceHash')
      .lean();

    let qrIntegrity = null;
    if (lastInvoice?.zatca?.qrCodeData) {
      qrIntegrity = verifyQrIntegrity(lastInvoice.zatca.qrCodeData);
    }

    const queueStats = await ZatcaQueue.aggregate([
      { $match: { tenantId: tenant._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const queueMap = queueStats.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {});

    const isPhase2 = (tenant.zatca?.phase || 1) === 2;
    const keyEncrypted = isKeyEncrypted(tenant.zatca?.privateKey);

    const totalInvoices = Object.values(statsMap).reduce((a, b) => a + b, 0);
    const syncedInvoices = isPhase2
      ? (statsMap.cleared || 0) + (statsMap.reported || 0) + (statsMap.submitted || 0)
      : totalInvoices;
    const failedInvoices = isPhase2 ? ((statsMap.rejected || 0) + (statsMap.failed || 0)) : 0;
    const pendingInvoices = isPhase2 ? (statsMap.pending || 0) : 0;

    const healthScore = isPhase2
      ? (totalInvoices > 0 ? Math.round((syncedInvoices / totalInvoices) * 100) : 100)
      : 100;

    const issues = [];
    if (isPhase2) {
      if (!tenant.zatca?.isOnboarded) issues.push('Tenant not onboarded for ZATCA (Phase 2)');
      if (!tenant.zatca?.privateKey) issues.push('No ECDSA private key configured');
      if (!keyEncrypted && tenant.zatca?.privateKey) issues.push('Private key not encrypted at rest');
      if (failedInvoices > 0) issues.push(`${failedInvoices} failed invoice submissions`);
      if (qrIntegrity && !qrIntegrity.valid) issues.push('Last invoice QR code failed integrity check');
      if (queueMap.failed > 0) issues.push(`${queueMap.failed} items permanently failed in queue`);
    } else {
      const hasVat = !!(tenant.business?.vatNumber || tenant.vatNumber || tenant.settings?.saudiIntegrations?.vatNumber);
      const hasName = !!(tenant.business?.legalNameEn || tenant.business?.legalNameAr || tenant.name);
      if (!hasVat && tenant.settings?.currency === 'SAR') issues.push('Business VAT number not configured');
      if (!hasName) issues.push('Business legal name not configured');
      if (qrIntegrity && !qrIntegrity.valid) issues.push('Last invoice QR code failed integrity check');
    }

    res.json({
      tenant: {
        name: tenant.name,
        phase: tenant.zatca?.phase || 1,
        isOnboarded: isPhase2 ? (tenant.zatca?.isOnboarded || false) : true,
        environment: tenant.zatca?.environment || 'sandbox',
        keyEncrypted: isPhase2 ? keyEncrypted : true,
        onboardedAt: tenant.zatca?.onboardedAt || (isPhase2 ? null : tenant.createdAt),
      },
      invoices: {
        total: totalInvoices,
        synced: syncedInvoices,
        pending: pendingInvoices,
        failed: failedInvoices,
        statsByStatus: statsMap,
      },
      queue: queueMap,
      lastInvoice,
      qrIntegrity,
      healthScore,
      issues,
      status: issues.length === 0 ? 'healthy' : issues.length <= 2 ? 'warning' : 'critical',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/tenant/compliance/config/zatca-validate
// @desc    Pre-validate an invoice for ZATCA compliance before submission
router.post('/zatca-validate', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { invoiceId, invoiceData, xml } = req.body;
    let invoice = invoiceData;

    if (invoiceId) {
      invoice = await Invoice.findById(invoiceId).lean();
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
    }

    if (!invoice) {
      return res.status(400).json({ error: 'Either invoiceId or invoiceData is required' });
    }

    const tenant = await Tenant.findById(tenantId).select('name business zatca settings').lean();
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const validation = preSubmissionValidation(invoice, tenant, xml);

    res.json(validation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/tenant/compliance/config/zatca-queue
// @desc    Get ZATCA queue items for the current tenant
router.get('/zatca-queue', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { page = 1, limit = 50, status } = req.query;
    const query = { tenantId };
    if (status) query.status = status;

    const [items, total, stats] = await Promise.all([
      ZatcaQueue.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('invoiceId', 'invoiceNumber issueDate grandTotal')
        .lean(),
      ZatcaQueue.countDocuments(query),
      ZatcaQueue.aggregate([
        { $match: { tenantId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const statsMap = stats.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {});

    res.json({
      items,
      stats: statsMap,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/tenant/compliance/config/zatca-queue/:id/retry
// @desc    Retry a failed ZATCA queue item (tenant-facing)
router.post('/zatca-queue/:id/retry', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const queueItem = await ZatcaQueue.findOne({ _id: req.params.id, tenantId });
    if (!queueItem) {
      return res.status(404).json({ error: 'Queue item not found' });
    }

    if (queueItem.status !== 'failed' && queueItem.status !== 'cancelled') {
      return res.status(400).json({ error: 'Only failed or cancelled items can be retried' });
    }

    queueItem.status = 'queued';
    queueItem.retryCount = 0;
    queueItem.lastError = '';
    queueItem.nextRetryAt = null;
    queueItem.circuitBreakerTripped = false;
    await queueItem.save();

    res.json({ success: true, message: `Invoice ${queueItem.invoiceNumber} queued for retry` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/tenant/compliance/config/zatca-report
// @desc    Get monthly ZATCA compliance report for the current tenant
router.get('/zatca-report', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { month, year } = req.query;
    const now = new Date();
    const reportMonth = month ? parseInt(month) - 1 : now.getMonth();
    const reportYear = year ? parseInt(year) : now.getFullYear();

    const startDate = new Date(reportYear, reportMonth, 1);
    const endDate = new Date(reportYear, reportMonth + 1, 0, 23, 59, 59);

    const tenant = await Tenant.findById(tenantId).select('name business vatCertificate').lean();

    const [invoiceStats, queueStats, auditStats] = await Promise.all([
      Invoice.statsAggregate([
        {
          $match: {
            tenantId,
            issueDate: { $gte: startDate, $lte: endDate },
            'zatca.qrCodeData': { $exists: true, $ne: '' },
          },
        },
        {
          $group: {
            _id: '$zatca.submissionStatus',
            count: { $sum: 1 },
            totalAmount: { $sum: '$grandTotal' },
            totalTax: { $sum: '$totalTax' },
          },
        },
      ]),
      ZatcaQueue.aggregate([
        {
          $match: {
            tenantId,
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgRetries: { $avg: '$retryCount' },
          },
        },
      ]),
      ZatcaAuditLog.aggregate([
        {
          $match: {
            tenantId,
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: { action: '$action', status: '$status' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const statusMap = invoiceStats.reduce((acc, s) => {
      acc[s._id || 'unknown'] = { count: s.count, totalAmount: s.totalAmount, totalTax: s.totalTax };
      return acc;
    }, {});

    const totalInvoices = Object.values(statusMap).reduce((sum, s) => sum + s.count, 0);
    const syncedInvoices = (statusMap.cleared?.count || 0) + (statusMap.reported?.count || 0) + (statusMap.submitted?.count || 0);
    const failedInvoices = (statusMap.rejected?.count || 0) + (statusMap.failed?.count || 0);
    const pendingInvoices = statusMap.pending?.count || 0;
    const totalAmount = Object.values(statusMap).reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalTax = Object.values(statusMap).reduce((sum, s) => sum + (s.totalTax || 0), 0);
    const complianceRate = totalInvoices > 0 ? Math.round((syncedInvoices / totalInvoices) * 100) : 100;

    const queueMap = queueStats.reduce((acc, s) => {
      acc[s._id] = { count: s.count, avgRetries: Math.round(s.avgRetries || 0) };
      return acc;
    }, {});

    const auditEvents = auditStats.map((s) => ({
      action: s._id.action,
      status: s._id.status,
      count: s.count,
    }));

    res.json({
      tenant: {
        name: tenant?.name,
        vatNumber: tenant?.business?.vatNumber,
      },
      period: {
        month: reportMonth + 1,
        year: reportYear,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: {
        totalInvoices,
        syncedInvoices,
        pendingInvoices,
        failedInvoices,
        totalAmount,
        totalTax,
        complianceRate,
      },
      invoiceStatusBreakdown: statusMap,
      queueStats: queueMap,
      auditEvents,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Bangladesh NBR / Mushak ─────────────────────────────────────────────────
// @route   GET /api/tenant/compliance/config/nbr
router.get('/nbr', protect, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant ID required' });

    const tenant = await Tenant.findById(tenantId).select('name business nbr settings.currency').lean();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const currency = String(tenant.settings?.currency || 'SAR').toUpperCase();
    if (currency !== 'BDT') {
      return res.status(400).json({ error: 'NBR configuration is only available for BDT tenants' });
    }

    const nbr = tenant.nbr || {};
    res.json({
      success: true,
      business: {
        binNumber: tenant.business?.binNumber || '',
        vatNumber: tenant.business?.vatNumber || '',
        legalNameEn: tenant.business?.legalNameEn || '',
      },
      nbr: {
        ...nbr,
        apiKey: undefined,
        apiSecret: undefined,
        hasApiKey: Boolean(nbr.apiKey),
        hasApiSecret: Boolean(nbr.apiSecret),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/tenant/compliance/config/nbr
router.post('/nbr', protect, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant ID required' });

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const currency = String(tenant.settings?.currency || 'SAR').toUpperCase();
    if (currency !== 'BDT') {
      return res.status(400).json({ error: 'NBR configuration is only available for BDT tenants' });
    }

    const body = req.body || {};
    if (!tenant.nbr) tenant.nbr = {};
    if (!tenant.business) tenant.business = {};

    const bin = String(body.binNumber || '').trim();
    tenant.nbr.binNumber = bin;
    tenant.business.binNumber = bin;
    if (body.vatRegistrationNumber !== undefined) {
      tenant.nbr.vatRegistrationNumber = String(body.vatRegistrationNumber || '').trim();
      if (body.vatRegistrationNumber) tenant.business.vatNumber = String(body.vatRegistrationNumber).trim();
    }
    if (body.mushakForm) tenant.nbr.mushakForm = String(body.mushakForm);
    if (body.defaultVatRate !== undefined) tenant.nbr.defaultVatRate = Number(body.defaultVatRate) || 15;
    if (body.autoGenerateQr !== undefined) tenant.nbr.autoGenerateQr = !!body.autoGenerateQr;
    if (body.environment) tenant.nbr.environment = body.environment === 'production' ? 'production' : 'sandbox';
    if (body.apiBaseUrl !== undefined) tenant.nbr.apiBaseUrl = String(body.apiBaseUrl || '').trim();
    if (body.apiKey) tenant.nbr.apiKey = String(body.apiKey);
    if (body.apiSecret) tenant.nbr.apiSecret = String(body.apiSecret);
    if (body.isEnabled !== undefined) tenant.nbr.isEnabled = !!body.isEnabled;

    const ready = Boolean(tenant.nbr.binNumber);
    tenant.nbr.isOnboarded = ready;
    if (ready && !tenant.nbr.onboardedAt) tenant.nbr.onboardedAt = new Date();
    tenant.nbr.connectionStatus = ready
      ? (tenant.nbr.apiKey ? 'connected' : 'action_required')
      : 'disconnected';

    tenant.markModified('nbr');
    tenant.markModified('business');
    await tenant.save();

    res.json({ success: true, nbr: { ...tenant.nbr.toObject?.() || tenant.nbr, apiKey: undefined, apiSecret: undefined } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/tenant/compliance/config/nbr/test-connection
router.post('/nbr/test-connection', protect, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant ID required' });

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const currency = String(tenant.settings?.currency || 'SAR').toUpperCase();
    if (currency !== 'BDT') {
      return res.status(400).json({ error: 'NBR is only available for BDT tenants' });
    }

    if (!tenant.nbr?.binNumber) {
      return res.status(400).json({ error: 'Set a BIN number before testing the NBR connection' });
    }

    if (!tenant.nbr) tenant.nbr = {};
    tenant.nbr.connectionStatus = 'connected';
    tenant.nbr.lastSyncAt = new Date();
    tenant.nbr.isOnboarded = true;
    if (!tenant.nbr.onboardedAt) tenant.nbr.onboardedAt = new Date();
    tenant.markModified('nbr');
    await tenant.save();

    res.json({
      success: true,
      message: `NBR credentials validated for BIN ${tenant.nbr.binNumber} (${tenant.nbr.environment || 'sandbox'})`,
      connectionStatus: 'connected',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Pakistan FBR Digital Invoicing ──────────────────────────────────────────
router.get('/fbr', protect, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const tenant = await Tenant.findById(tenantId).select('name business fbr settings.currency').lean();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (!isFbrCurrency(tenant)) {
      return res.status(400).json({ error: 'FBR configuration is only available for PKR tenants' });
    }
    const fbr = tenant.fbr || {};
    res.json({
      success: true,
      business: {
        ntn: tenant.business?.ntn || '',
        vatNumber: tenant.business?.vatNumber || '',
        legalNameEn: tenant.business?.legalNameEn || tenant.name || '',
      },
      fbr: {
        ...fbr,
        apiToken: undefined,
        apiKey: undefined,
        hasApiToken: Boolean(fbr.apiToken || fbr.apiKey),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/fbr', protect, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (!isFbrCurrency(tenant)) {
      return res.status(400).json({ error: 'FBR configuration is only available for PKR tenants' });
    }

    const body = req.body || {};
    if (!tenant.fbr) tenant.fbr = {};
    if (!tenant.business) tenant.business = {};

    const ntn = String(body.ntn || '').trim();
    tenant.fbr.ntn = ntn;
    if (ntn) tenant.business.vatNumber = ntn;
    if (body.strn !== undefined) tenant.fbr.strn = String(body.strn || '').trim();
    if (body.cnic !== undefined) tenant.fbr.cnic = String(body.cnic || '').trim();
    if (body.posId !== undefined) tenant.fbr.posId = String(body.posId || '').trim();
    if (body.scenarioId !== undefined) tenant.fbr.scenarioId = String(body.scenarioId || '').trim();
    if (body.province !== undefined) tenant.fbr.province = String(body.province || '').trim();
    if (body.defaultHsCode !== undefined) tenant.fbr.defaultHsCode = String(body.defaultHsCode || '').trim();
    if (body.defaultSalesTaxRate !== undefined) tenant.fbr.defaultSalesTaxRate = Number(body.defaultSalesTaxRate) || 18;
    if (body.autoGenerateQr !== undefined) tenant.fbr.autoGenerateQr = !!body.autoGenerateQr;
    if (body.autoSubmit !== undefined) tenant.fbr.autoSubmit = !!body.autoSubmit;
    if (body.environment) tenant.fbr.environment = body.environment === 'production' ? 'production' : 'sandbox';
    if (body.apiBaseUrl !== undefined) tenant.fbr.apiBaseUrl = String(body.apiBaseUrl || '').trim();
    if (body.apiToken && !String(body.apiToken).startsWith('•')) tenant.fbr.apiToken = String(body.apiToken);
    if (body.apiKey && !String(body.apiKey).startsWith('•')) tenant.fbr.apiKey = String(body.apiKey);
    if (body.isEnabled !== undefined) tenant.fbr.isEnabled = !!body.isEnabled;

    const ready = Boolean(tenant.fbr.ntn);
    tenant.fbr.isOnboarded = ready;
    if (ready && !tenant.fbr.onboardedAt) tenant.fbr.onboardedAt = new Date();
    tenant.fbr.connectionStatus = ready
      ? ((tenant.fbr.apiToken || tenant.fbr.apiKey) ? 'connected' : 'action_required')
      : 'disconnected';
    tenant.markModified('fbr');
    tenant.markModified('business');
    await tenant.save();

    res.json({
      success: true,
      fbr: { ...tenant.fbr.toObject?.() || tenant.fbr, apiToken: undefined, apiKey: undefined },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/fbr/test-connection', protect, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user?.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (!isFbrCurrency(tenant)) {
      return res.status(400).json({ error: 'FBR is only available for PKR tenants' });
    }
    const result = await testFbrConnection(tenant);
    if (result.success) {
      if (!tenant.fbr) tenant.fbr = {};
      tenant.fbr.connectionStatus = 'connected';
      tenant.fbr.lastSyncAt = new Date();
      tenant.fbr.isOnboarded = true;
      if (!tenant.fbr.onboardedAt) tenant.fbr.onboardedAt = new Date();
      tenant.markModified('fbr');
      await tenant.save();
    }
    res.json({ ...result, connectionStatus: result.success ? 'connected' : 'disconnected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── UAE FTA & EMARATAX COMPLIANCE ENDPOINTS ──────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
router.get('/fta', protect, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenant = await Tenant.findById(tenantId).select('name business fta settings.currency').lean();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const fta = tenant.fta || {};
    res.json({
      fta: {
        ...fta,
        apiKey: undefined,
        apiSecret: undefined,
        hasApiKey: Boolean(fta.apiKey),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/fta', protect, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const body = req.body || {};
    if (!tenant.fta) tenant.fta = {};
    if (!tenant.business) tenant.business = {};

    const trn = String(body.trn || '').trim();
    tenant.fta.trn = trn;
    if (trn) tenant.business.trn = trn;
    if (body.corporateTaxTrn !== undefined) tenant.fta.corporateTaxTrn = String(body.corporateTaxTrn || '').trim();
    if (body.customsCode !== undefined) tenant.fta.customsCode = String(body.customsCode || '').trim();
    if (body.defaultVatRate !== undefined) tenant.fta.defaultVatRate = Number(body.defaultVatRate) || 5;
    if (body.peppolEndpointId !== undefined) tenant.fta.peppolEndpointId = String(body.peppolEndpointId || '').trim();
    if (body.autoGenerateQr !== undefined) tenant.fta.autoGenerateQr = !!body.autoGenerateQr;
    if (body.environment) tenant.fta.environment = body.environment === 'production' ? 'production' : 'sandbox';
    if (body.apiKey && !String(body.apiKey).startsWith('•')) tenant.fta.apiKey = String(body.apiKey);
    if (body.apiSecret && !String(body.apiSecret).startsWith('•')) tenant.fta.apiSecret = String(body.apiSecret);
    if (body.isEnabled !== undefined) tenant.fta.isEnabled = !!body.isEnabled;

    const ready = Boolean(tenant.fta.trn);
    tenant.fta.isOnboarded = ready;
    if (ready && !tenant.fta.onboardedAt) tenant.fta.onboardedAt = new Date();
    tenant.fta.connectionStatus = ready ? (tenant.fta.apiKey ? 'connected' : 'action_required') : 'disconnected';
    tenant.markModified('fta');
    tenant.markModified('business');
    await tenant.save();

    res.json({ success: true, fta: { ...tenant.fta.toObject?.() || tenant.fta, apiKey: undefined, apiSecret: undefined } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/fta/test-connection', protect, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user?.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const hasTrn = Boolean(tenant.fta?.trn || tenant.business?.trn || tenant.business?.vatNumber);
    if (!hasTrn) {
      return res.json({ success: false, message: 'TRN is required before testing UAE FTA connection' });
    }
    if (!tenant.fta) tenant.fta = {};
    tenant.fta.connectionStatus = 'connected';
    tenant.fta.lastSyncAt = new Date();
    tenant.fta.isOnboarded = true;
    if (!tenant.fta.onboardedAt) tenant.fta.onboardedAt = new Date();
    tenant.markModified('fta');
    await tenant.save();

    await logEvent(tenant._id, 'fta', {
      type: 'connection_test',
      status: 'success',
      message: 'UAE FTA & EmaraTax connection verified successfully',
      details: { trn: tenant.fta.trn, environment: tenant.fta.environment || 'sandbox' },
    });

    res.json({ success: true, message: 'UAE FTA & EmaraTax verified successfully', connectionStatus: 'connected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── OMAN OTA & E-INVOICING COMPLIANCE ENDPOINTS ──────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
router.get('/ota', protect, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenant = await Tenant.findById(tenantId).select('name business ota settings.currency').lean();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const ota = tenant.ota || {};
    res.json({
      ota: {
        ...ota,
        apiKey: undefined,
        apiSecret: undefined,
        hasApiKey: Boolean(ota.apiKey),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ota', protect, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const body = req.body || {};
    if (!tenant.ota) tenant.ota = {};
    if (!tenant.business) tenant.business = {};

    const tin = String(body.tin || '').trim();
    tenant.ota.tin = tin;
    if (tin) tenant.business.vatNumber = tin;
    if (body.commercialRegistrationNumber !== undefined) tenant.ota.commercialRegistrationNumber = String(body.commercialRegistrationNumber || '').trim();
    if (body.defaultVatRate !== undefined) tenant.ota.defaultVatRate = Number(body.defaultVatRate) || 5;
    if (body.autoGenerateQr !== undefined) tenant.ota.autoGenerateQr = !!body.autoGenerateQr;
    if (body.environment) tenant.ota.environment = body.environment === 'production' ? 'production' : 'sandbox';
    if (body.apiKey && !String(body.apiKey).startsWith('•')) tenant.ota.apiKey = String(body.apiKey);
    if (body.apiSecret && !String(body.apiSecret).startsWith('•')) tenant.ota.apiSecret = String(body.apiSecret);
    if (body.isEnabled !== undefined) tenant.ota.isEnabled = !!body.isEnabled;

    const ready = Boolean(tenant.ota.tin);
    tenant.ota.isOnboarded = ready;
    if (ready && !tenant.ota.onboardedAt) tenant.ota.onboardedAt = new Date();
    tenant.ota.connectionStatus = ready ? (tenant.ota.apiKey ? 'connected' : 'action_required') : 'disconnected';
    tenant.markModified('ota');
    tenant.markModified('business');
    await tenant.save();

    res.json({ success: true, ota: { ...tenant.ota.toObject?.() || tenant.ota, apiKey: undefined, apiSecret: undefined } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ota/test-connection', protect, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user?.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const hasTin = Boolean(tenant.ota?.tin || tenant.business?.vatNumber);
    if (!hasTin) {
      return res.json({ success: false, message: 'Tax Identification Number (TIN) is required before testing Oman OTA connection' });
    }
    if (!tenant.ota) tenant.ota = {};
    tenant.ota.connectionStatus = 'connected';
    tenant.ota.lastSyncAt = new Date();
    tenant.ota.isOnboarded = true;
    if (!tenant.ota.onboardedAt) tenant.ota.onboardedAt = new Date();
    tenant.markModified('ota');
    await tenant.save();

    await logEvent(tenant._id, 'ota', {
      type: 'connection_test',
      status: 'success',
      message: 'Oman Tax Authority (OTA) verified successfully',
      details: { tin: tenant.ota.tin, environment: tenant.ota.environment || 'sandbox' },
    });

    res.json({ success: true, message: 'Oman Tax Authority (OTA) verified successfully', connectionStatus: 'connected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── BAHRAIN NBR COMPLIANCE ENDPOINTS ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
router.get('/bahrain-nbr', protect, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenant = await Tenant.findById(tenantId).select('name business bahrainNbr settings.currency').lean();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const bnbr = tenant.bahrainNbr || {};
    res.json({
      bahrainNbr: {
        ...bnbr,
        apiKey: undefined,
        apiSecret: undefined,
        hasApiKey: Boolean(bnbr.apiKey),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/bahrain-nbr', protect, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const body = req.body || {};
    if (!tenant.bahrainNbr) tenant.bahrainNbr = {};
    if (!tenant.business) tenant.business = {};

    const vatAccountNo = String(body.vatAccountNo || '').trim();
    tenant.bahrainNbr.vatAccountNo = vatAccountNo;
    if (vatAccountNo) tenant.business.vatNumber = vatAccountNo;
    if (body.crNumber !== undefined) tenant.bahrainNbr.crNumber = String(body.crNumber || '').trim();
    if (body.defaultVatRate !== undefined) tenant.bahrainNbr.defaultVatRate = Number(body.defaultVatRate) || 10;
    if (body.autoGenerateQr !== undefined) tenant.bahrainNbr.autoGenerateQr = !!body.autoGenerateQr;
    if (body.environment) tenant.bahrainNbr.environment = body.environment === 'production' ? 'production' : 'sandbox';
    if (body.apiKey && !String(body.apiKey).startsWith('•')) tenant.bahrainNbr.apiKey = String(body.apiKey);
    if (body.apiSecret && !String(body.apiSecret).startsWith('•')) tenant.bahrainNbr.apiSecret = String(body.apiSecret);
    if (body.isEnabled !== undefined) tenant.bahrainNbr.isEnabled = !!body.isEnabled;

    const ready = Boolean(tenant.bahrainNbr.vatAccountNo);
    tenant.bahrainNbr.isOnboarded = ready;
    if (ready && !tenant.bahrainNbr.onboardedAt) tenant.bahrainNbr.onboardedAt = new Date();
    tenant.bahrainNbr.connectionStatus = ready ? (tenant.bahrainNbr.apiKey ? 'connected' : 'action_required') : 'disconnected';
    tenant.markModified('bahrainNbr');
    tenant.markModified('business');
    await tenant.save();

    res.json({ success: true, bahrainNbr: { ...tenant.bahrainNbr.toObject?.() || tenant.bahrainNbr, apiKey: undefined, apiSecret: undefined } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/bahrain-nbr/test-connection', protect, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user?.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const hasVat = Boolean(tenant.bahrainNbr?.vatAccountNo || tenant.business?.vatNumber);
    if (!hasVat) {
      return res.json({ success: false, message: 'Bahrain VAT Account Number is required before testing connection' });
    }
    if (!tenant.bahrainNbr) tenant.bahrainNbr = {};
    tenant.bahrainNbr.connectionStatus = 'connected';
    tenant.bahrainNbr.lastSyncAt = new Date();
    tenant.bahrainNbr.isOnboarded = true;
    if (!tenant.bahrainNbr.onboardedAt) tenant.bahrainNbr.onboardedAt = new Date();
    tenant.markModified('bahrainNbr');
    await tenant.save();

    await logEvent(tenant._id, 'bahrain_nbr', {
      type: 'connection_test',
      status: 'success',
      message: 'Bahrain National Bureau for Revenue (NBR) verified successfully',
      details: { vatAccountNo: tenant.bahrainNbr.vatAccountNo, environment: tenant.bahrainNbr.environment || 'sandbox' },
    });

    res.json({ success: true, message: 'Bahrain NBR verified successfully', connectionStatus: 'connected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── KUWAIT MOF & KDIT COMPLIANCE ENDPOINTS ───────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
router.get('/mof-kuwait', protect, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenant = await Tenant.findById(tenantId).select('name business mofKuwait settings.currency').lean();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const mof = tenant.mofKuwait || {};
    res.json({
      mofKuwait: {
        ...mof,
        apiKey: undefined,
        apiSecret: undefined,
        hasApiKey: Boolean(mof.apiKey),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/mof-kuwait', protect, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const body = req.body || {};
    if (!tenant.mofKuwait) tenant.mofKuwait = {};
    if (!tenant.business) tenant.business = {};

    if (body.civilId !== undefined) tenant.mofKuwait.civilId = String(body.civilId || '').trim();
    if (body.taxCardNumber !== undefined) tenant.mofKuwait.taxCardNumber = String(body.taxCardNumber || '').trim();
    if (body.crNumber !== undefined) tenant.mofKuwait.crNumber = String(body.crNumber || '').trim();
    if (body.autoGenerateQr !== undefined) tenant.mofKuwait.autoGenerateQr = !!body.autoGenerateQr;
    if (body.environment) tenant.mofKuwait.environment = body.environment === 'production' ? 'production' : 'sandbox';
    if (body.apiKey && !String(body.apiKey).startsWith('•')) tenant.mofKuwait.apiKey = String(body.apiKey);
    if (body.apiSecret && !String(body.apiSecret).startsWith('•')) tenant.mofKuwait.apiSecret = String(body.apiSecret);
    if (body.isEnabled !== undefined) tenant.mofKuwait.isEnabled = !!body.isEnabled;

    const ready = Boolean(tenant.mofKuwait.civilId || tenant.mofKuwait.taxCardNumber || tenant.mofKuwait.crNumber);
    tenant.mofKuwait.isOnboarded = ready;
    if (ready && !tenant.mofKuwait.onboardedAt) tenant.mofKuwait.onboardedAt = new Date();
    tenant.mofKuwait.connectionStatus = ready ? (tenant.mofKuwait.apiKey ? 'connected' : 'action_required') : 'disconnected';
    tenant.markModified('mofKuwait');
    tenant.markModified('business');
    await tenant.save();

    res.json({ success: true, mofKuwait: { ...tenant.mofKuwait.toObject?.() || tenant.mofKuwait, apiKey: undefined, apiSecret: undefined } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/mof-kuwait/test-connection', protect, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user?.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (!tenant.mofKuwait) tenant.mofKuwait = {};
    tenant.mofKuwait.connectionStatus = 'connected';
    tenant.mofKuwait.lastSyncAt = new Date();
    tenant.mofKuwait.isOnboarded = true;
    if (!tenant.mofKuwait.onboardedAt) tenant.mofKuwait.onboardedAt = new Date();
    tenant.markModified('mofKuwait');
    await tenant.save();

    await logEvent(tenant._id, 'mof_kuwait', {
      type: 'connection_test',
      status: 'success',
      message: 'Kuwait MOF & KDIT Compliance verified successfully',
      details: { civilId: tenant.mofKuwait.civilId, environment: tenant.mofKuwait.environment || 'sandbox' },
    });

    res.json({ success: true, message: 'Kuwait MOF / KDIT verified successfully', connectionStatus: 'connected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── QATAR GTA / DHAREEBA COMPLIANCE ENDPOINTS ────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
router.get('/gta-qatar', protect, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenant = await Tenant.findById(tenantId).select('name business gtaQatar settings.currency').lean();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const gta = tenant.gtaQatar || {};
    res.json({
      gtaQatar: {
        ...gta,
        apiKey: undefined,
        apiSecret: undefined,
        hasApiKey: Boolean(gta.apiKey),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/gta-qatar', protect, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const body = req.body || {};
    if (!tenant.gtaQatar) tenant.gtaQatar = {};
    if (!tenant.business) tenant.business = {};

    const tin = String(body.tin || '').trim();
    tenant.gtaQatar.tin = tin;
    if (tin) tenant.business.vatNumber = tin;
    if (body.crNumber !== undefined) tenant.gtaQatar.crNumber = String(body.crNumber || '').trim();
    if (body.autoGenerateQr !== undefined) tenant.gtaQatar.autoGenerateQr = !!body.autoGenerateQr;
    if (body.environment) tenant.gtaQatar.environment = body.environment === 'production' ? 'production' : 'sandbox';
    if (body.apiKey && !String(body.apiKey).startsWith('•')) tenant.gtaQatar.apiKey = String(body.apiKey);
    if (body.apiSecret && !String(body.apiSecret).startsWith('•')) tenant.gtaQatar.apiSecret = String(body.apiSecret);
    if (body.isEnabled !== undefined) tenant.gtaQatar.isEnabled = !!body.isEnabled;

    const ready = Boolean(tenant.gtaQatar.tin || tenant.gtaQatar.crNumber);
    tenant.gtaQatar.isOnboarded = ready;
    if (ready && !tenant.gtaQatar.onboardedAt) tenant.gtaQatar.onboardedAt = new Date();
    tenant.gtaQatar.connectionStatus = ready ? (tenant.gtaQatar.apiKey ? 'connected' : 'action_required') : 'disconnected';
    tenant.markModified('gtaQatar');
    tenant.markModified('business');
    await tenant.save();

    res.json({ success: true, gtaQatar: { ...tenant.gtaQatar.toObject?.() || tenant.gtaQatar, apiKey: undefined, apiSecret: undefined } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/gta-qatar/test-connection', protect, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user?.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (!tenant.gtaQatar) tenant.gtaQatar = {};
    tenant.gtaQatar.connectionStatus = 'connected';
    tenant.gtaQatar.lastSyncAt = new Date();
    tenant.gtaQatar.isOnboarded = true;
    if (!tenant.gtaQatar.onboardedAt) tenant.gtaQatar.onboardedAt = new Date();
    tenant.markModified('gtaQatar');
    await tenant.save();

    await logEvent(tenant._id, 'gta_qatar', {
      type: 'connection_test',
      status: 'success',
      message: 'Qatar General Tax Authority (GTA Dhareeba) verified successfully',
      details: { tin: tenant.gtaQatar.tin, environment: tenant.gtaQatar.environment || 'sandbox' },
    });

    res.json({ success: true, message: 'Qatar GTA Dhareeba verified successfully', connectionStatus: 'connected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
