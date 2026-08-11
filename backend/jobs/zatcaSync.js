import Invoice from '../models/Invoice.js';
import Tenant from '../models/Tenant.js';
import ZatcaService from '../utils/zatca/ZatcaService.js';
import logger from '../utils/logger.js';
import { isZatcaCurrency } from '../utils/zatcaCurrency.js';

export async function syncZatcaInvoices() {
  try {
    // Find all B2C invoices pending reporting (within 24-hour window)
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 24);
    
    const pendingInvoices = await Invoice.find({
      transactionType: 'B2C',
      'zatca.submissionStatus': 'pending',
      status: { $in: ['approved', 'sent'] },
      createdAt: { $gte: cutoffTime }
    }).populate('tenantId');
    
    logger.info(`Found ${pendingInvoices.length} B2C invoices pending ZATCA reporting`);
    
    const results = {
      total: pendingInvoices.length,
      success: 0,
      failed: 0,
      errors: []
    };
    
    // Group by tenant for batch processing
    const invoicesByTenant = {};
    for (const invoice of pendingInvoices) {
      const tenantId = invoice.tenantId._id.toString();
      if (!invoicesByTenant[tenantId]) {
        invoicesByTenant[tenantId] = {
          tenant: invoice.tenantId,
          invoices: []
        };
      }
      invoicesByTenant[tenantId].invoices.push(invoice);
    }
    
    // Process each tenant's invoices
    for (const tenantId in invoicesByTenant) {
      const { tenant, invoices } = invoicesByTenant[tenantId];
      
      if (!isZatcaCurrency(tenant)) {
        logger.warn(`Tenant ${tenant.name} is not SAR-denominated, skipping ${invoices.length} ZATCA invoices`);
        continue;
      }

      if (!tenant.zatca?.isOnboarded || !tenant.zatca?.productionCsid) {
        logger.warn(`Tenant ${tenant.name} not onboarded to ZATCA, skipping ${invoices.length} invoices`);
        continue;
      }
      
      const { decryptZatcaConfig } = await import('../utils/zatcaKeyVault.js');
      const zatcaConfig = decryptZatcaConfig(tenant.zatca);
      const zatcaService = new ZatcaService({
        privateKey: zatcaConfig.privateKey,
        csid: zatcaConfig.productionCsid,
        previousInvoiceHash: zatcaConfig.lastInvoiceHash
      });
      
      for (const invoice of invoices) {
        try {
          // Submit for reporting
          const reportResult = await zatcaService.submitForReporting(
            invoice.zatca.signedXml,
            invoice.zatca.invoiceHash,
            invoice.zatca.uuid
          );
          
          if (reportResult.success) {
            invoice.zatca.submissionStatus = 'reported';
            invoice.zatca.reportingStatus = reportResult.reportingStatus;
            invoice.zatca.zatcaResponse = reportResult;
            invoice.zatca.submittedAt = new Date();
            
            results.success++;
            logger.info(`Invoice ${invoice.invoiceNumber} reported successfully`);
          } else {
            invoice.zatca.submissionStatus = reportResult.validationResults?.status === 'WARNING' ? 'warning' : 'rejected';
            invoice.zatca.lastError = reportResult.errors?.join(', ') || reportResult.error;
            invoice.zatca.zatcaResponse = reportResult;
            invoice.zatca.retryCount = (invoice.zatca.retryCount || 0) + 1;
            
            results.failed++;
            results.errors.push({
              invoiceNumber: invoice.invoiceNumber,
              error: invoice.zatca.lastError
            });
            logger.error(`Invoice ${invoice.invoiceNumber} reporting failed: ${invoice.zatca.lastError}`);
          }
          
          await invoice.save();
          
          // Rate limiting - wait 200ms between requests
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          results.failed++;
          results.errors.push({
            invoiceNumber: invoice.invoiceNumber,
            error: error.message
          });
          logger.error(`Error processing invoice ${invoice.invoiceNumber}: ${error.message}`);
        }
      }
      
      // Update tenant's last invoice hash
      const lastProcessedInvoice = invoices[invoices.length - 1];
      if (lastProcessedInvoice?.zatca?.invoiceHash) {
        await Tenant.findByIdAndUpdate(tenantId, {
          'zatca.lastInvoiceHash': lastProcessedInvoice.zatca.invoiceHash
        });
      }
    }
    
    logger.info(`ZATCA sync completed: ${results.success} success, ${results.failed} failed`);
    return results;
    
  } catch (error) {
    logger.error(`ZATCA sync job failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export default syncZatcaInvoices;
