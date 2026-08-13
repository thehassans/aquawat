import zlib from 'zlib';
import Tenant from '../models/Tenant.js';
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
import Quotation from '../models/Quotation.js';
import DeliveryNote from '../models/DeliveryNote.js';
import EmailMessage from '../models/EmailMessage.js';
import {
  WhatsAppConfig,
  WhatsAppContact,
  WhatsAppMessage,
  WhatsAppTemplate,
  QuickReply,
  Broadcast,
} from '../models/WhatsApp.js';

export const TENANT_BACKUP_COLLECTIONS = [
  { name: 'customers', model: Customer },
  { name: 'suppliers', model: Supplier },
  { name: 'employees', model: Employee },
  { name: 'payrolls', model: Payroll },
  { name: 'expenses', model: Expense },
  { name: 'invoices', model: Invoice },
  { name: 'quotations', model: Quotation },
  { name: 'deliveryNotes', model: DeliveryNote },
  { name: 'emailMessages', model: EmailMessage },
  { name: 'products', model: Product },
  { name: 'warehouses', model: Warehouse },
  { name: 'projects', model: Project },
  { name: 'tasks', model: Task },
  { name: 'purchaseOrders', model: PurchaseOrder },
  { name: 'shipments', model: Shipment },
  { name: 'iotDevices', model: IoTDevice },
  { name: 'iotReadings', model: IoTReading },
  { name: 'whatsAppConfig', model: WhatsAppConfig },
  { name: 'whatsAppContacts', model: WhatsAppContact },
  { name: 'whatsAppMessages', model: WhatsAppMessage },
  { name: 'whatsAppTemplates', model: WhatsAppTemplate },
  { name: 'quickReplies', model: QuickReply },
  { name: 'broadcasts', model: Broadcast },
];

async function writeTenantBackupLines(writeLine, tenant) {
  const tenantId = tenant._id;
  writeLine({ type: 'tenant', tenantId: String(tenantId), doc: tenant });
  for (const c of TENANT_BACKUP_COLLECTIONS) {
    const cursor = c.model.find({ tenantId }).lean().cursor();
    for await (const doc of cursor) {
      writeLine({ type: 'doc', collection: c.name, tenantId: String(tenantId), doc });
    }
  }
}

export async function streamGzipJsonlBackup(req, res, { filename, meta, tenants }) {
  req.setTimeout(0);
  res.setTimeout(0);
  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const gzip = zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED });
  gzip.pipe(res);
  const writeLine = (obj) => gzip.write(`${JSON.stringify(obj)}\n`);

  writeLine(meta);
  for (const tenant of tenants) {
    writeLine({
      type: 'tenant_start',
      tenantId: String(tenant._id),
      slug: tenant.slug,
      name: tenant.name,
    });
    await writeTenantBackupLines(writeLine, tenant);
    writeLine({ type: 'tenant_end', tenantId: String(tenant._id) });
  }
  gzip.end();
}

export async function streamSingleTenantBackup(req, res, tenant) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `backup_${tenant.slug || tenant._id}_${dateStr}.jsonl.gz`;
  await streamGzipJsonlBackup(req, res, {
    filename,
    meta: {
      type: 'meta',
      version: 1,
      scope: 'tenant',
      generatedAt: new Date().toISOString(),
      tenantId: String(tenant._id),
    },
    tenants: [tenant],
  });
}

export async function streamAllTenantsBackup(req, res) {
  const tenants = await Tenant.find({}).lean();
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `maqder_all_tenants_backup_${dateStr}.jsonl.gz`;
  await streamGzipJsonlBackup(req, res, {
    filename,
    meta: {
      type: 'meta',
      version: 1,
      scope: 'all',
      generatedAt: new Date().toISOString(),
      tenantCount: tenants.length,
    },
    tenants,
  });
}
