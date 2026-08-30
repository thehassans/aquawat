import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure Partner (+ Customer/Supplier populate aliases) register before route models load
import './models/Partner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { initSocket } from './lib/socket.js';

import authRoutes from './routes/auth.routes.js';
import tenantRoutes from './routes/tenant.routes.js';
import searchRoutes from './routes/search.routes.js';
import employeeRoutes from './routes/employee.routes.js';
import payrollRoutes from './routes/payroll.routes.js';
import hrRoutes from './routes/hr.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import quotationRoutes from './routes/quotation.routes.js';
import salesRoutes from './routes/sales.routes.js';
import portalRoutes from './routes/portal.routes.js';
import salesReportingRoutes from './routes/salesReporting.routes.js';
import shippingRoutes from './routes/shipping.routes.js';
import productRoutes from './routes/product.routes.js';
import warehouseRoutes from './routes/warehouse.routes.js';
import supplierRoutes from './routes/supplier.routes.js';
import purchaseOrderRoutes from './routes/purchaseOrder.routes.js';
import shipmentRoutes from './routes/shipment.routes.js';
import projectRoutes from './routes/project.routes.js';
import taskRoutes from './routes/task.routes.js';
import iotRoutes from './routes/iot.routes.js';
import jobCostingRoutes from './routes/jobCosting.routes.js';
import mrpRoutes from './routes/mrp.routes.js';
import superAdminRoutes from './routes/superAdmin.routes.js';
import leadsRoutes from './routes/leads.routes.js';
import leadSetupRoutes from './routes/leadSetup.routes.js';
import aiRoutes from './routes/ai.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import zatcaRoutes from './routes/zatca.routes.js';
import communicateRoutes from './routes/communicate.routes.js';
import customerRoutes from './routes/customer.routes.js';
import partnerRoutes from './routes/partner.routes.js';
import contactsRoutes from './routes/contacts.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import expenseClaimRoutes from './routes/expenseClaim.routes.js';
import accountingRoutes from './routes/accounting.routes.js';
import usersRoutes from './routes/users.routes.js';
import publicRoutes from './routes/public.routes.js';
import travelBookingRoutes from './routes/travelBooking.routes.js';
import restaurantMenuItemRoutes from './routes/restaurantMenuItem.routes.js';
import restaurantOrderRoutes from './routes/restaurantOrder.routes.js';
import restaurantTableRoutes from './routes/restaurantTable.routes.js';
import restaurantInventoryRoutes from './routes/restaurantInventory.routes.js';
import emailRoutes from './routes/email.routes.js';
import smsRoutes from './routes/sms.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import zatcaWebhookRoutes from './routes/zatcaWebhook.routes.js';
import fleetRoutes from './routes/fleet.routes.js';
import contractRoutes from './routes/contract.routes.js';
import landedCostRoutes from './routes/landedCost.routes.js';
import manpowerRoutes from './routes/manpower.routes.js';
import complianceRoutes from './routes/compliance.routes.js';
import tenantComplianceRoutes from './routes/tenantCompliance.routes.js';
import superAdminZatcaRoutes from './routes/superAdminZatca.routes.js';
import resellerRoutes from './routes/reseller.routes.js';
import resellerPanelRoutes from './routes/resellerPanel.routes.js';
import paymentRoutes, { stripeWebhookHandler } from './routes/payment.routes.js';
import rentalCarRoutes from './routes/rentalCar.routes.js';
import rentalCustomerRoutes from './routes/rentalCustomer.routes.js';
import rentalContractRoutes from './routes/rentalContract.routes.js';
import bakalaRoutes from './routes/bakala.routes.js';
import bakalaProductsRoutes from './routes/bakala.products.routes.js';
import pharmacyRoutes from './routes/pharmacy.routes.js';
import expiryWasteRoutes from './routes/expiryWaste.routes.js';
import promotionRoutes from './routes/promotion.routes.js';
import profitMarginRoutes from './routes/profitMargin.routes.js';
import reorderRoutes from './routes/reorder.routes.js';
import dailyPnlRoutes from './routes/dailyPnl.routes.js';
import bookstoreRoutes from './routes/bookstore.routes.js';
import restaurantReservationRoutes from './routes/restaurantReservation.routes.js';
import saloonAppointmentRoutes from './routes/saloonAppointment.routes.js';
import laundryDeliveryRoutes from './routes/laundryDelivery.routes.js';
import rentalMaintenanceRoutes from './routes/rentalMaintenance.routes.js';
import boutiqueCalendarRoutes from './routes/boutiqueCalendar.routes.js';
import manpowerTimesheetRoutes from './routes/manpowerTimesheet.routes.js';
import workshopServiceRoutes from './routes/workshopService.routes.js';
import khayyatMeasurementRoutes from './routes/khayyatMeasurement.routes.js';
import restaurantComboRoutes from './routes/restaurantCombo.routes.js';
import restaurantKDSRoutes from './routes/restaurantKDS.routes.js';
import restaurantMessRoutes from './routes/restaurantMess.routes.js';
import restaurantDeliveryRoutes, { webhookRouter as deliveryWebhookRouter } from './routes/restaurantDelivery.routes.js';
import posSessionsRoutes from './routes/posSessions.routes.js';
import posTerminalSessionRoutes from './routes/posTerminalSession.routes.js';
import khataRoutes from './routes/khata.routes.js';
import grnRoutes from './routes/grn.routes.js';
import purchaseReturnsRoutes from './routes/purchaseReturns.routes.js';
import inventoryAdjustmentsRoutes from './routes/inventoryAdjustments.routes.js';
import stockTransferRoutes from './routes/stockTransfer.routes.js';
import stockRoutes from './routes/stock.routes.js';
import invPublicApiRoutes from './routes/invPublicApi.routes.js';
import inventoryPresentationRoutes from './routes/inventory.routes.js';
import voucherRoutes from './routes/voucher.routes.js';

import backupRoutes from './routes/backup.routes.js';
import syncRoutes from './routes/syncRoutes.js';
import desktopSyncRoutes from './routes/desktopSync.routes.js';
import deliveryNoteRoutes from './routes/deliveryNote.routes.js';

import laundryServiceRoutes from './routes/laundryService.routes.js';
import laundryCustomerRoutes from './routes/laundryCustomer.routes.js';
import laundryOrderRoutes from './routes/laundryOrder.routes.js';
import laundryInventoryRoutes from './routes/laundryInventory.routes.js';
import saloonServiceRoutes from './routes/saloonService.routes.js';
import saloonOrderRoutes from './routes/saloonOrder.routes.js';
import saloonStaffRoutes from './routes/saloonStaff.routes.js';
import posPaymentRoutes from './routes/posPayment.routes.js';

import workshopRoutes from './routes/workshop.routes.js';
import crmRoutes from './routes/crm.routes.js';
import khayyatWorkerRoutes from './routes/khayyat/worker.js';
import khayyatEmbroideryRoutes from './routes/khayyat/embroideryDesigns.js';
import khayyatFabricRoutes from './routes/khayyat/fabric.js';
import khayyatLaundryRoutes from './routes/khayyat/laundry.js';
import khayyatStitchingRoutes from './routes/khayyat/stitching.js';
import khayyatPaymentRoutes from './routes/khayyat/payment.js';
import khayyatUserRoutes from './routes/khayyat/user.js';
import khayyatCustomerRoutes from './routes/khayyat/customer.js';
import marqueeRoutes from './routes/marquee.routes.js';
import khayyatCustomizationRoutes from './routes/khayyat/customization.js';
import boutiqueRoutes from './routes/boutique.routes.js';
import furnitureRoutes from './routes/furniture.routes.js';
import branchRoutes from './routes/branch.routes.js';
import appStoreRoutes from './routes/appStore.routes.js';
import manufacturingRoutes from './routes/manufacturing.routes.js';
import bomRoutes from './routes/bom.routes.js';
import gymRoutes from './routes/gym.routes.js';
import calendarRoutes from './routes/calendar.routes.js';

import { checkIqamaExpiry } from './jobs/iqamaChecker.js';
import { processScheduledReports } from './jobs/reportScheduleJob.js';
import { syncZatcaInvoices } from './jobs/zatcaSync.js';
import { fetchImapEmails } from './jobs/imapFetcher.js';
import { startBoutiqueReminderJobs } from './jobs/boutiqueReminderJob.js';
import { checkRestaurantAutoStatus } from './jobs/restaurantAutoStatusJob.js';
import { markOverdueInvoices } from './jobs/invoiceOverdueJob.js';
import { expireEndedSubscriptions } from './jobs/expireSubscriptions.js';
import { processQueue as processZatcaQueue } from './services/zatcaQueueProcessor.js';
import { runZatcaMonitoring, runCertExpiryCheck } from './jobs/zatcaMonitoringJob.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import requestTimeout from './middleware/requestTimeout.js';
import responseTime from './middleware/responseTime.js';
import { etag } from './middleware/httpCache.js';
import { gateSensitiveUploads } from './middleware/uploadsAccess.js';
import { mongoSanitize } from './middleware/mongoSanitize.js';
import { csrfCookieGuard } from './middleware/csrfOrigin.js';
import { isRedisReady, cacheSet, cacheSetNx } from './lib/redis.js';
import { makeRateLimitStore } from './utils/hybridRateLimitStore.js';
import logger from './utils/logger.js';
import User from './models/User.js';
import Tenant from './models/Tenant.js';
import Supplier from './models/Supplier.js';
import { seedAlliedPowerTenant } from './scripts/seedAlliedPowerTenant.js';
import { validateProductionEnv } from './utils/envValidation.js';
import { applySecretFiles } from './utils/secretFiles.js';
import { requestIdMiddleware } from './utils/requestId.js';
import SystemSettings from './models/SystemSettings.js';
import { initErrorTracking } from './utils/errorTracking.js';
import { getRateLimitConfig, loadRateLimitConfig } from './utils/rateLimitConfig.js';
import { startInvoicePdfWorker } from './services/invoicePdfQueue.js';
import { ensureAtlasSearchIndex } from './utils/invoiceSearch.js';
import { backfillMissingTrackTokens } from './models/khayyat/KhayyatStitching.js';
import { backfillSellOrderLineIds } from './scripts/backfillSellOrderLineIds.js';
import { sloSnapshot } from './utils/sloMetrics.js';
import { evaluateSloAndAlert } from './jobs/sloAlertJob.js';

dotenv.config();
applySecretFiles();
validateProductionEnv({ logger });

mongoose.set('bufferCommands', false);

// Global Mongoose query timeout — prevents runaway queries from blocking workers
mongoose.set('debug', false);
// Apply a 25-second timeout to all queries automatically
mongoose.plugin((schema) => {
  schema.pre(['find', 'findOne', 'findOneAndUpdate', 'count', 'countDocuments', 'aggregate'], function () {
    if (!this._mongooseOptions?.timeout) {
      this.maxTimeMS(25000);
    }
  });
});

const app = express();
const parsedTrustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 1);
const trustProxyHops = Number.isFinite(parsedTrustProxyHops) && parsedTrustProxyHops >= 0 ? parsedTrustProxyHops : 1;
const parsedMongoServerSelectionTimeoutMs = Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 5000);
const mongoServerSelectionTimeoutMs = Number.isFinite(parsedMongoServerSelectionTimeoutMs) && parsedMongoServerSelectionTimeoutMs > 0 ? parsedMongoServerSelectionTimeoutMs : 5000;
const parsedMongoSocketTimeoutMs = Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 45000);
const mongoSocketTimeoutMs = Number.isFinite(parsedMongoSocketTimeoutMs) && parsedMongoSocketTimeoutMs > 0 ? parsedMongoSocketTimeoutMs : 45000;
const parsedMongoReconnectIntervalMs = Number(process.env.MONGODB_RECONNECT_INTERVAL_MS || 5000);
const mongoReconnectIntervalMs = Number.isFinite(parsedMongoReconnectIntervalMs) && parsedMongoReconnectIntervalMs > 0 ? parsedMongoReconnectIntervalMs : 5000;
const defaultMongoRequestWaitTimeoutMs = Math.max(mongoServerSelectionTimeoutMs + 500, 6000);
const parsedMongoRequestWaitTimeoutMs = Number(process.env.MONGODB_REQUEST_WAIT_TIMEOUT_MS || defaultMongoRequestWaitTimeoutMs);
const mongoRequestWaitTimeoutMs = Number.isFinite(parsedMongoRequestWaitTimeoutMs) && parsedMongoRequestWaitTimeoutMs > 0 ? parsedMongoRequestWaitTimeoutMs : defaultMongoRequestWaitTimeoutMs;
const configuredOrigins = String(process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowCloudflareInsights = process.env.NODE_ENV === 'production';
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/zatca-erp';
const databaseReadyState = () => mongoose.connection.readyState;
const isDatabaseReady = () => databaseReadyState() === 1;
let reconnectTimer = null;
let jobsStarted = false;
let databaseConnectionPromise = null;

// Cron leadership — CRON_WORKER=0 never runs jobs (PM2 API workers).
// CRON_WORKER=1 or development always run. Otherwise Redis NX election.
const WORKER_ID = Number(process.env.WORKER_ID || 1);
const CRON_WORKER_ENV = process.env.CRON_WORKER;
const DISABLE_CRON = CRON_WORKER_ENV === '0';
const FORCE_CRON_WORKER = CRON_WORKER_ENV === '1' || process.env.NODE_ENV === 'development';

const seedSuperAdmin = async () => {
  try {
    const existingAdmin = await User.findOne({ role: 'super_admin' });
    if (existingAdmin) return;

    const email = process.env.SUPER_ADMIN_EMAIL || 'admin@maqder.com';
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const insecureDefault = !password || password === 'SuperAdmin@123';

    if (process.env.NODE_ENV === 'production' && insecureDefault) {
      logger.error('Refusing to seed super_admin in production without a strong SUPER_ADMIN_PASSWORD');
      return;
    }

    await User.create({
      email,
      password: password || 'SuperAdmin@123',
      firstName: 'Super',
      lastName: 'Admin',
      firstNameAr: 'المشرف',
      lastNameAr: 'العام',
      role: 'super_admin',
      isActive: true,
      preferences: { language: 'en', theme: 'light' },
    });
    logger.info('Super Admin created: ' + email);
    if (insecureDefault) {
      logger.warn('Super admin seeded with development default password — change immediately');
    }
  } catch (err) {
    logger.error('Auto-seed super admin error:', err.message);
  }
};

const startJobs = async () => {
  if (jobsStarted) {
    return;
  }

  if (DISABLE_CRON) {
    logger.info(`[server] Worker ${WORKER_ID} — skipping cron jobs (CRON_WORKER=0)`);
    return;
  }

  let shouldRun = FORCE_CRON_WORKER;
  if (!shouldRun) {
    const acquired = await cacheSetNx('cron:leader', { workerId: WORKER_ID, at: Date.now() }, 90);
    if (acquired) {
      shouldRun = true;
      setInterval(() => {
        cacheSet('cron:leader', { workerId: WORKER_ID, at: Date.now() }, 90).catch(() => {});
      }, 30_000).unref();
    } else if (!isRedisReady() && WORKER_ID === 1) {
      // Redis unavailable — fall back to classic worker #1 ownership
      shouldRun = true;
    } else {
      logger.info(`[server] Worker ${WORKER_ID} — skipping cron jobs (another leader holds lock)`);
      setInterval(async () => {
        if (jobsStarted) return;
        const got = await cacheSetNx('cron:leader', { workerId: WORKER_ID, at: Date.now() }, 90);
        if (got) startJobs();
      }, 60_000).unref();
      return;
    }
  }

  if (!shouldRun) {
    return;
  }

  jobsStarted = true;
  logger.info(`[server] Worker ${WORKER_ID} — starting cron jobs`);

  cron.schedule('0 8 * * *', () => {
    logger.info('Running Iqama expiry check...');
    checkIqamaExpiry();
  });

  cron.schedule('0 */6 * * *', () => {
    logger.info('Running ZATCA B2C invoice sync...');
    syncZatcaInvoices();
  });

  cron.schedule('*/2 * * * *', async () => {
    logger.info('Running ZATCA queue processor...');
    await processZatcaQueue(25);
  });

  cron.schedule('0 2 * * *', async () => {
    logger.info('Running ZATCA nightly monitoring (chain + QR + certs)...');
    await runZatcaMonitoring();
  });

  cron.schedule('0 8 * * *', async () => {
    logger.info('Running ZATCA certificate expiry check...');
    await runCertExpiryCheck();
  });

  cron.schedule('*/15 * * * *', async () => {
    logger.info('Running scheduled reports job...');
    await processScheduledReports();
  });

  cron.schedule('* * * * *', async () => {
    await fetchImapEmails();
  });

  // Boutique rental reminders & overdue alerts
  startBoutiqueReminderJobs();

  // Restaurant auto open/close based on time
  cron.schedule('* * * * *', async () => {
    await checkRestaurantAutoStatus();
  });

  cron.schedule('5 0 * * *', async () => {
    logger.info('Marking overdue invoices (Asia/Riyadh)...');
    await markOverdueInvoices();
  }, { timezone: 'Asia/Riyadh' });

  cron.schedule('15 0 * * *', async () => {
    logger.info('Expiring ended SaaS subscriptions (Asia/Riyadh)...');
    await expireEndedSubscriptions();
  }, { timezone: 'Asia/Riyadh' });

  cron.schedule('*/2 * * * *', async () => {
    await evaluateSloAndAlert({
      dbReady: isDatabaseReady(),
      redisReady: isRedisReady(),
      redisRequired: process.env.REDIS_ENABLED !== 'false',
    });
  });

  cron.schedule('0 */4 * * *', async () => {
    try {
      const { runAmazonMarketplaceSync } = await import('./services/sales/amazonMarketplaceSync.js');
      await runAmazonMarketplaceSync();
    } catch (err) {
      logger.warn(`[amazon-sync] cron failed: ${err.message}`);
    }
  });

  if (process.env.STOCK_SCHEDULER_CRON === '1') {
    const { startInventoryScheduler } = await import('./jobs/inventoryScheduler.js');
    startInventoryScheduler();
  }
};

const scheduleReconnect = () => {
  if (reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToDatabase();
  }, mongoReconnectIntervalMs);
};

const connectToDatabase = async () => {
  if (databaseReadyState() === 1) {
    return Promise.resolve(mongoose.connection);
  }

  if (databaseReadyState() === 2) {
    return databaseConnectionPromise || mongoose.connection.asPromise();
  }

  if (databaseConnectionPromise) {
    return databaseConnectionPromise;
  }

  databaseConnectionPromise = mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: mongoServerSelectionTimeoutMs,
    socketTimeoutMS: mongoSocketTimeoutMs,
    waitQueueTimeoutMS: Number(process.env.MONGODB_WAIT_QUEUE_TIMEOUT_MS || 10_000),
    maxConnecting: Number(process.env.MONGODB_MAX_CONNECTING || 5),
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 20),
    minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 2),
    maxIdleTimeMS: 30_000,
    heartbeatFrequencyMS: 10_000,
    compressors: 'zlib',
    readPreference: process.env.MONGODB_READ_PREFERENCE || 'primary',
  })
    .then(async () => {
      logger.info('MongoDB connected successfully');
      await seedSuperAdmin();
      try {
        const alliedTenant = await Tenant.findOne({ slug: 'allied-power' });
        const supplierCount = alliedTenant ? await Supplier.countDocuments({ tenantId: alliedTenant._id }) : 0;
        if (!alliedTenant || supplierCount === 0) {
          logger.info('Auto-seeding Allied Power Industrial Company data...');
          await seedAlliedPowerTenant();
        }
      } catch (seedErr) {
        logger.error('Auto-seed Allied Power error:', seedErr.message);
      }
      // Drop old unique indexes that prevent creating tenants without CR/VAT
      try {
        const db = mongoose.connection.db;
        await db.collection('tenants').dropIndex('business.vatNumber_1');
        logger.info('Dropped unique index business.vatNumber_1');
      } catch (_) { /* index may not exist */ }
      try {
        const db = mongoose.connection.db;
        await db.collection('tenants').dropIndex('business.crNumber_1');
        logger.info('Dropped unique index business.crNumber_1');
      } catch (_) { /* index may not exist */ }
      try {
        const settings = await SystemSettings.findOne({ key: 'global' }).select('errorTracking').lean();
        await initErrorTracking(settings);
      } catch (trackErr) {
        logger.warn(`[errorTracking] init failed: ${trackErr.message}`);
      }
      try {
        await loadRateLimitConfig();
      } catch (rateErr) {
        logger.warn(`[rateLimit] config load failed: ${rateErr.message}`);
      }
      try {
        await ensureAtlasSearchIndex();
      } catch (searchErr) {
        logger.warn(`[invoiceSearch] init failed: ${searchErr.message}`);
      }
      try {
        let filled = 0;
        for (let i = 0; i < 20; i += 1) {
          const batch = await backfillMissingTrackTokens(2000);
          filled += batch;
          if (batch < 2000) break;
        }
        if (filled > 0) {
          logger.info(`[khayyat] backfilled trackToken on ${filled} orders`);
        }
      } catch (tokenErr) {
        logger.warn(`[khayyat] trackToken backfill failed: ${tokenErr.message}`);
      }
      try {
        await backfillSellOrderLineIds({ limit: 2000 });
      } catch (lineIdErr) {
        logger.warn(`[migrate] sell PO line _ids failed: ${lineIdErr.message}`);
      }
      startJobs();
    })
    .catch((err) => {
      logger.error('MongoDB connection error:', err);
      scheduleReconnect();
      throw err;
    })
    .finally(() => {
      databaseConnectionPromise = null;
    });

  return databaseConnectionPromise;
};

const waitForDatabaseReady = async () => {
  if (isDatabaseReady()) {
    return true;
  }

  try {
    await Promise.race([
      connectToDatabase(),
      new Promise((resolve) => setTimeout(resolve, mongoRequestWaitTimeoutMs))
    ]);
  } catch {
  }

  return isDatabaseReady();
};

const ensureDatabaseReady = async (req, res, next) => {
  if (isDatabaseReady()) {
    return next();
  }

  const ready = await waitForDatabaseReady();
  if (ready) {
    return next();
  }

  res.setHeader('Retry-After', '2');
  return res.status(503).json({
    error: 'Database is reconnecting. Please retry in a moment.',
    code: 'DB_UNAVAILABLE',
  });
};

// ─── Performance/observability middleware (applied before everything) ────────
app.use(requestIdMiddleware);
app.use(responseTime());

// Security middleware
app.set('trust proxy', trustProxyHops);
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'img-src': [
        "'self'",
        "data:",
        "blob:",
        "https://images.unsplash.com",
        "https://plus.unsplash.com",
        "https://picsum.photos",
        "https://fastly.picsum.photos"
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com"
      ],
      'font-src': [
        "'self'",
        "data:",
        "https://fonts.gstatic.com"
      ],
      'script-src': [
        "'self'",
        ...(allowCloudflareInsights ? ['https://static.cloudflareinsights.com'] : []),
      ],
      'script-src-elem': [
        "'self'",
        ...(allowCloudflareInsights ? ['https://static.cloudflareinsights.com'] : []),
      ],
      'connect-src': [
        "'self'",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
        ...(allowCloudflareInsights
          ? [
            'https://cloudflareinsights.com',
            'https://*.cloudflareinsights.com',
            'https://static.cloudflareinsights.com',
          ]
          : []),
      ],
    },
  },
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    // Production: never allow empty allowlist or wildcard with credentials
    if (configuredOrigins.length === 0) {
      if (process.env.NODE_ENV === 'production') {
        console.warn('[CORS] Blocked origin: no FRONTEND_URL configured');
        return callback(null, false);
      }
      return callback(null, true);
    }

    if (configuredOrigins.includes('*')) {
      if (process.env.NODE_ENV === 'production') {
        console.warn('[CORS] Wildcard FRONTEND_URL rejected in production');
        return callback(null, false);
      }
      return callback(null, true);
    }

    // Exact match first
    if (configuredOrigins.includes(origin)) return callback(null, true);

    // Flexible match: allow any origin that contains one of the configured
    // base domains. This handles www., http vs https, subdomains, etc.
    const isAllowed = configuredOrigins.some((configured) => {
      try {
        const configuredHost = new URL(configured).hostname.replace(/^www\./, '');
        const originHost = new URL(origin).hostname.replace(/^www\./, '');
        return originHost === configuredHost || originHost.endsWith('.' + configuredHost);
      } catch {
        return false;
      }
    });

    if (isAllowed) return callback(null, true);

    console.warn(`[CORS] Blocked origin: ${origin} | Allowed: ${configuredOrigins.join(', ')}`);
    // false = no ACAO header, request still continues. Throwing Error here became HTTP 500
    // and skipped csrfCookieGuard (cookie+evil Origin must be 403 CSRF, not 500).
    return callback(null, false);
  },
  credentials: true
}));

// Gzip compression — reduces response sizes by 60-80% (biggest single latency win)
app.use(compression({ threshold: 1024 }));


// ─── Tiered rate limiting ─────────────────────────────────────────────────────
// Helper to get real client IP behind load balancers/Cloudflare/Nginx
const getClientIp = (req) => {
  return req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) ||
    req.ip ||
    '127.0.0.1';
};

// Redis HybridRateLimitStore is shared across cluster workers (see hybridRateLimitStore.js).

// 1. Auth endpoints — 40 req / 15 min (override via AUTH_RATE_LIMIT_MAX)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: () => getRateLimitConfig().authMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeRateLimitStore('auth'),
  keyGenerator: (req) => getClientIp(req),
  message: { error: 'Too many auth requests. Please wait and try again.' },
});

// 2. Public endpoints — lenient (10 000 req / 15 min)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PUBLIC_RATE_LIMIT_MAX || 10000),
  standardHeaders: true,
  legacyHeaders: false,
  store: makeRateLimitStore('public'),
  keyGenerator: (req) => getClientIp(req),
  message: { error: 'Too many requests. Please try again later.' },
});

// Key by authenticated tenantId when protect already ran (req.user set).
// Never base64-decode JWT without verify — that trusts a forged payload for quota keys.
// Unauthenticated traffic is keyed by client IP only.
const getTenantOrIpKey = (req) => {
  if (req.user?.tenantId) return `tenant:${req.user.tenantId}`;
  if (req.user?._id || req.user?.id) return `user:${req.user._id || req.user.id}`;
  return getClientIp(req);
};

// 3. General API — configurable (default 15 000 req / 15 min)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: () => getRateLimitConfig().apiMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeRateLimitStore('api'),
  keyGenerator: getTenantOrIpKey,
  skip: (req) => {
    const p = req.path || '';
    return p.startsWith('/health') ||
      p.startsWith('/desktop-sync/ping') ||
      p.startsWith('/sync/status') ||
      p.startsWith('/notifications') ||
      p.startsWith('/auth/me') ||
      p.startsWith('/zatca-compliance/health');
  },
  message: { error: 'Too many requests, please try again later.' },
});

// 4. AI/OCR endpoints — expensive (external model calls, image/document processing).
//    Much tighter than the general API cap so a runaway client or abuse can't
//    exhaust paid AI quota or hog CPU on document parsing/OCR.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_MAX || 180),
  standardHeaders: true,
  legacyHeaders: false,
  store: makeRateLimitStore('ai'),
  keyGenerator: getTenantOrIpKey,
  message: { error: 'Too many AI requests. Please wait a few minutes and try again.' },
});

app.use('/api/auth/', authLimiter);
app.use('/api/public/', publicLimiter);
app.use('/api/ai/', aiLimiter);
app.use('/api/', limiter);
app.use('/api/', etag());

// ─── Request timeout (60 s hard cap on all API routes) ────────────────────────
const apiTimeoutMs = Number(process.env.API_REQUEST_TIMEOUT_MS || 60_000);
app.use('/api/', requestTimeout(Number.isFinite(apiTimeoutMs) && apiTimeoutMs > 0 ? apiTimeoutMs : 60_000));

// Body parsing — Stripe webhook needs the raw body for signature verification
app.post('/api/payments/stripe-webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '10mb';
app.use(express.json({
  limit: jsonBodyLimit,
  verify: (req, _res, buf) => {
    req.rawBody = Buffer.from(buf);
  },
}));
app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));
app.use(cookieParser());
app.use(csrfCookieGuard);

// Strip Mongo operator keys ($…) from body/query/params (express-mongo-sanitize not installed)
app.use(mongoSanitize);

app.locals.waitForDatabaseReady = waitForDatabaseReady;

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: isDatabaseReady() ? 'OK' : 'DEGRADED',
    database: {
      readyState: databaseReadyState(),
      connected: isDatabaseReady(),
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health/live', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/health/ready', (req, res) => {
  const redisRequired = process.env.REDIS_ENABLED !== 'false';
  const redisReady = isRedisReady();
  const dbReady = isDatabaseReady();

  if (!dbReady || (redisRequired && !redisReady)) {
    return res.status(503).json({
      status: 'NOT_READY',
      database: {
        readyState: databaseReadyState(),
        connected: dbReady,
      },
      redis: {
        enabled: redisRequired,
        ready: redisReady,
      },
      timestamp: new Date().toISOString()
    });
  }

  return res.json({
    status: 'READY',
    database: {
      readyState: databaseReadyState(),
      connected: true,
    },
    redis: {
      enabled: redisRequired,
      ready: redisReady,
    },
    slo: sloSnapshot(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health/slo', (req, res) => {
  const snap = sloSnapshot();
  const p95Ms = Number(process.env.SLO_P95_MS || 2000);
  const errorRate = Number(process.env.SLO_ERROR_RATE || 0.05);
  const breached = snap.count >= 20 && (snap.p95Ms > p95Ms || snap.errorRate > errorRate);
  res.status(breached ? 503 : 200).json({
    status: breached ? 'BREACHED' : 'OK',
    limits: { p95Ms, errorRate },
    ...snap,
    timestamp: new Date().toISOString(),
  });
});

// Serve uploads — catalog/branding stay public; HR/receipts/khayyat require auth
const uploadsStatic = express.static(path.join(__dirname, 'public', 'uploads'), {
  index: false,
  dotfiles: 'deny',
});
app.use('/uploads', gateSensitiveUploads, uploadsStatic);
app.use('/api/uploads', gateSensitiveUploads, uploadsStatic);

// API Routes
app.use('/api/public', publicRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/webhooks', ensureDatabaseReady, webhookRoutes);
app.use('/api/webhooks/zatca', ensureDatabaseReady, zatcaWebhookRoutes);
app.use('/api/auth', ensureDatabaseReady, authRoutes);
app.use('/api/tenants', ensureDatabaseReady, tenantRoutes);
app.use('/api/search', ensureDatabaseReady, searchRoutes);
app.use('/api/email', ensureDatabaseReady, emailRoutes);
app.use('/api/sms', ensureDatabaseReady, smsRoutes);
app.use('/api/employees', ensureDatabaseReady, employeeRoutes);
app.use('/api/payroll', ensureDatabaseReady, payrollRoutes);
app.use('/api/hr', ensureDatabaseReady, hrRoutes);
app.use('/api/invoices', ensureDatabaseReady, invoiceRoutes);
app.use('/api/quotations', ensureDatabaseReady, quotationRoutes);
app.use('/api/sales', ensureDatabaseReady, salesRoutes);
app.use('/api/sales/reporting', ensureDatabaseReady, salesReportingRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/shipping', ensureDatabaseReady, shippingRoutes);
app.use('/api/products', ensureDatabaseReady, productRoutes);
app.use('/api/warehouses', ensureDatabaseReady, warehouseRoutes);
app.use('/api/suppliers', ensureDatabaseReady, supplierRoutes);
app.use('/api/purchase-orders', ensureDatabaseReady, purchaseOrderRoutes);
app.use('/api/purchases/orders', ensureDatabaseReady, purchaseOrderRoutes);
app.use('/api/shipments', ensureDatabaseReady, shipmentRoutes);
app.use('/api/projects', ensureDatabaseReady, projectRoutes);
app.use('/api/tasks', ensureDatabaseReady, taskRoutes);
app.use('/api/iot', ensureDatabaseReady, iotRoutes);
app.use('/api/job-costing', ensureDatabaseReady, jobCostingRoutes);
app.use('/api/mrp', ensureDatabaseReady, mrpRoutes);
app.use('/api/super-admin', ensureDatabaseReady, superAdminRoutes);
app.use('/api/leads', ensureDatabaseReady, leadsRoutes);
app.use('/api/lead-setup', ensureDatabaseReady, leadSetupRoutes);
app.use('/api/ai', ensureDatabaseReady, aiRoutes);
app.use('/api/dashboard', ensureDatabaseReady, dashboardRoutes);
app.use('/api/reports', ensureDatabaseReady, reportsRoutes);
app.use('/api/whatsapp', ensureDatabaseReady, whatsappRoutes);
app.use('/api/zatca', ensureDatabaseReady, zatcaRoutes);
app.use('/api/sync', ensureDatabaseReady, syncRoutes);
app.use('/api/desktop/sync', ensureDatabaseReady, desktopSyncRoutes);
app.use('/api/customers', ensureDatabaseReady, customerRoutes);
app.use('/api/partners', ensureDatabaseReady, partnerRoutes);
app.use('/api/communicate', ensureDatabaseReady, communicateRoutes);
app.use('/api/contacts', ensureDatabaseReady, contactsRoutes);
app.use('/api/calendar', ensureDatabaseReady, calendarRoutes);
app.use('/api/expenses', ensureDatabaseReady, expenseRoutes);
app.use('/api/expense-claims', ensureDatabaseReady, expenseClaimRoutes);
app.use('/api/accounting', ensureDatabaseReady, accountingRoutes);
app.use('/api/users', ensureDatabaseReady, usersRoutes);
app.use('/api/travel-bookings', ensureDatabaseReady, travelBookingRoutes);
app.use('/api/restaurant/menu-items', ensureDatabaseReady, restaurantMenuItemRoutes);
app.use('/api/restaurant/orders', ensureDatabaseReady, restaurantOrderRoutes);
app.use('/api/restaurant/tables', ensureDatabaseReady, restaurantTableRoutes);
app.use('/api/restaurant/inventory', ensureDatabaseReady, restaurantInventoryRoutes);
app.use('/api/fleet', ensureDatabaseReady, fleetRoutes);
app.use('/api/contracts', ensureDatabaseReady, contractRoutes);
app.use('/api/landed-costs', ensureDatabaseReady, landedCostRoutes);
app.use('/api/purchases/landed-costs', ensureDatabaseReady, landedCostRoutes);
app.use('/api/manpower', ensureDatabaseReady, manpowerRoutes);
app.use('/api/compliance', ensureDatabaseReady, complianceRoutes);
app.use('/api/tenant/compliance/config', ensureDatabaseReady, tenantComplianceRoutes);
app.use('/api/super-admin/zatca', ensureDatabaseReady, superAdminZatcaRoutes);
app.use('/api/super-admin', ensureDatabaseReady, resellerRoutes);
app.use('/api/reseller', ensureDatabaseReady, resellerPanelRoutes);
app.use('/api/rental/cars', ensureDatabaseReady, rentalCarRoutes);
app.use('/api/rental/customers', ensureDatabaseReady, rentalCustomerRoutes);
app.use('/api/rental/contracts', ensureDatabaseReady, rentalContractRoutes);
app.use('/api/bakala', ensureDatabaseReady, bakalaRoutes);
app.use('/api/bakala-products', ensureDatabaseReady, bakalaProductsRoutes);
app.use('/api/pharmacy', ensureDatabaseReady, pharmacyRoutes);
app.use('/api/bakala/expiry-waste', ensureDatabaseReady, expiryWasteRoutes);
app.use('/api/bakala/promotions', ensureDatabaseReady, promotionRoutes);
app.use('/api/bakala/margins', ensureDatabaseReady, profitMarginRoutes);
app.use('/api/bakala/reorder', ensureDatabaseReady, reorderRoutes);
app.use('/api/bookstore', ensureDatabaseReady, bookstoreRoutes);
app.use('/api/bakala/pnl', ensureDatabaseReady, dailyPnlRoutes);
app.use('/api/restaurant/reservations', ensureDatabaseReady, restaurantReservationRoutes);
app.use('/api/saloon/appointments', ensureDatabaseReady, saloonAppointmentRoutes);
app.use('/api/laundry/routes', ensureDatabaseReady, laundryDeliveryRoutes);
app.use('/api/rental/maintenance', ensureDatabaseReady, rentalMaintenanceRoutes);
app.use('/api/boutique/calendar', ensureDatabaseReady, boutiqueCalendarRoutes);
app.use('/api/manpower/timesheets', ensureDatabaseReady, manpowerTimesheetRoutes);
app.use('/api/workshop/service', ensureDatabaseReady, workshopServiceRoutes);
app.use('/api/khayyat/measurements', ensureDatabaseReady, khayyatMeasurementRoutes);
app.use('/api/restaurant/combos', ensureDatabaseReady, restaurantComboRoutes);
app.use('/api/restaurant/kds', ensureDatabaseReady, restaurantKDSRoutes);
app.use('/api/restaurant/mess', ensureDatabaseReady, restaurantMessRoutes);
app.use('/api/restaurant/delivery', ensureDatabaseReady, restaurantDeliveryRoutes);
app.use('/api/restaurant/delivery', deliveryWebhookRouter);
app.use('/api/pos-sessions', ensureDatabaseReady, posSessionsRoutes);
app.use('/api/pos-terminal', ensureDatabaseReady, posTerminalSessionRoutes);
app.use('/api/khata', ensureDatabaseReady, khataRoutes);
app.use('/api/grn', ensureDatabaseReady, grnRoutes);
app.use('/api/purchases/grn', ensureDatabaseReady, grnRoutes);
app.use('/api/purchase-returns', ensureDatabaseReady, purchaseReturnsRoutes);
app.use('/api/purchases/returns', ensureDatabaseReady, purchaseReturnsRoutes);
app.use('/api/vouchers', ensureDatabaseReady, voucherRoutes);
app.use('/api/backup', ensureDatabaseReady, backupRoutes);
app.use('/api/inventory-adjustments', ensureDatabaseReady, inventoryAdjustmentsRoutes);
app.use('/api/stock-transfers', ensureDatabaseReady, stockTransferRoutes);
app.use('/api/stock', ensureDatabaseReady, stockRoutes);
app.use('/api/v1/inventory', ensureDatabaseReady, invPublicApiRoutes);
app.use('/api/inventory', ensureDatabaseReady, inventoryPresentationRoutes);
app.use('/api/delivery-notes', ensureDatabaseReady, deliveryNoteRoutes);
app.use('/api/marquee', ensureDatabaseReady, marqueeRoutes);

app.use('/api/laundry/services', ensureDatabaseReady, laundryServiceRoutes);
app.use('/api/laundry/customers', ensureDatabaseReady, laundryCustomerRoutes);
app.use('/api/laundry/orders', ensureDatabaseReady, laundryOrderRoutes);
app.use('/api/laundry/inventory', ensureDatabaseReady, laundryInventoryRoutes);

app.use('/api/saloon/services', ensureDatabaseReady, saloonServiceRoutes);
app.use('/api/saloon/orders', ensureDatabaseReady, saloonOrderRoutes);
app.use('/api/saloon/staff', ensureDatabaseReady, saloonStaffRoutes);

app.use('/api/pos', ensureDatabaseReady, posPaymentRoutes);
app.use('/api/workshop', ensureDatabaseReady, workshopRoutes);
app.use('/api/crm', ensureDatabaseReady, crmRoutes);

app.use('/api/khayyat/worker', ensureDatabaseReady, khayyatWorkerRoutes);
app.use('/api/khayyat/embroidery-designs', ensureDatabaseReady, khayyatEmbroideryRoutes);
app.use('/api/khayyat/fabrics', ensureDatabaseReady, khayyatFabricRoutes);
app.use('/api/khayyat/laundry', ensureDatabaseReady, khayyatLaundryRoutes);
app.use('/api/khayyat/stitchings', ensureDatabaseReady, khayyatStitchingRoutes);
app.use('/api/khayyat/payments', ensureDatabaseReady, khayyatPaymentRoutes);
app.use('/api/khayyat/user', ensureDatabaseReady, khayyatUserRoutes);
app.use('/api/khayyat/customers', ensureDatabaseReady, khayyatCustomerRoutes);
app.use('/api/khayyat/customizations', ensureDatabaseReady, khayyatCustomizationRoutes);

app.use('/api/boutique', ensureDatabaseReady, boutiqueRoutes);
app.use('/api/furniture', ensureDatabaseReady, furnitureRoutes);
app.use('/api/branches', ensureDatabaseReady, branchRoutes);
app.use('/api/app-store', ensureDatabaseReady, appStoreRoutes);
app.use('/api/manufacturing', ensureDatabaseReady, manufacturingRoutes);
app.use('/api/bom', ensureDatabaseReady, bomRoutes);
app.use('/api/gym', ensureDatabaseReady, gymRoutes);

// Serve static frontend files in production
const resolveFrontendBuild = () => {
  const candidates = [
    {
      rootDir: path.join(__dirname, '../frontend/dist'),
      indexFile: path.join(__dirname, '../frontend/dist/index.html'),
      assetsDir: path.join(__dirname, '../frontend/dist/assets'),
    },
    {
      rootDir: path.join(__dirname, '..'),
      indexFile: path.join(__dirname, '../index.html'),
      assetsDir: path.join(__dirname, '../assets'),
    },
  ];

  return candidates.find((candidate) => fs.existsSync(candidate.indexFile) && fs.existsSync(candidate.assetsDir))
    || candidates.find((candidate) => fs.existsSync(candidate.indexFile))
    || null;
};

const isStaticAssetRequest = (requestPath = '') => requestPath.startsWith('/assets/') || path.extname(requestPath) !== '';

if (process.env.NODE_ENV === 'production') {
  const frontendBuild = resolveFrontendBuild();

  if (frontendBuild?.assetsDir && fs.existsSync(frontendBuild.assetsDir)) {
    app.use('/assets', express.static(frontendBuild.assetsDir, {
      index: false,
      fallthrough: false,
      immutable: true,
      maxAge: '1y',
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));
  }

  if (frontendBuild?.rootDir && frontendBuild?.indexFile) {
    app.use(express.static(frontendBuild.rootDir, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          return;
        }

        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }));

    app.get('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }

      if (isStaticAssetRequest(req.path)) {
        return res.status(404).end();
      }

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.sendFile(frontendBuild.indexFile);
    });
  } else {
    logger.warn('Production frontend build not found. Expected either frontend/dist or a parent directory deployment with index.html and assets/.');
  }
}

// Error handling
app.use(notFound);
app.use(errorHandler);

// MongoDB Connection
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
  scheduleReconnect();
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB runtime error:', err);
});

connectToDatabase();

const PORT = process.env.PORT || 5000;
const httpServer = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  startInvoicePdfWorker();
  import('./services/inventory/inventoryQueue.js')
    .then(({ startInventoryQueueWorker }) => startInventoryQueueWorker())
    .catch((err) => logger.warn(`[server] inventory queue worker: ${err.message}`));
});

// Initialize Socket.io using the HTTP server
initSocket(httpServer);

// ─── Keep-alive tuning ───────────────────────────────────────────────────────
// Prevents Nginx upstream connection resets under load.
// keepAliveTimeout must be > Nginx's keepalive_timeout (default 65 s).
httpServer.keepAliveTimeout = 65_000;
httpServer.headersTimeout   = 66_000; // must be > keepAliveTimeout
// Allow more simultaneous connections on a single-process VPS.
// IMPORTANT: Node treats maxConnections=0 as "accept zero connections" (ECONNRESET),
// not "unlimited". Only set when a positive limit is configured.
const maxConnections = Number(process.env.HTTP_MAX_CONNECTIONS || 0)
if (Number.isFinite(maxConnections) && maxConnections > 0) {
  httpServer.maxConnections = maxConnections
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);

  // Stop accepting new connections
  httpServer.close(async () => {
    logger.info('HTTP server closed');

    try {
      await mongoose.disconnect();
      logger.info('MongoDB disconnected cleanly');
    } catch (err) {
      logger.error('Error disconnecting MongoDB during shutdown:', err.message);
    }

    logger.info('Process exiting');
    process.exit(0);
  });

  // Force-exit if something hangs after 15 s
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 15_000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

export default app;
