import Employee from '../models/Employee.js';
import Tenant from '../models/Tenant.js';
import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';
import { isZatcaCurrency } from '../utils/zatcaCurrency.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function checkIqamaExpiry() {
  try {
    const today = new Date();
    const alertThreshold = new Date();
    alertThreshold.setDate(today.getDate() + 60);
    
    const employees = await Employee.aggregate([
      { $match: { isActive: true, status: 'active' } },
      { $unwind: '$documents' },
      {
        $match: {
          'documents.type': 'iqama',
          'documents.expiryDate': { $lte: alertThreshold },
          'documents.alertSent': { $ne: true }
        }
      },
      {
        $lookup: {
          from: 'tenants',
          localField: 'tenantId',
          foreignField: '_id',
          as: 'tenant'
        }
      },
      { $unwind: '$tenant' }
    ]);
    
    logger.info(`Found ${employees.length} employees with expiring Iqamas`);
    
    const alertsByTenant = {};
    
    for (const emp of employees) {
      // Iqama (Saudi residency permit) tracking only applies to Saudi
      // (SAR-denominated) tenants.
      if (!isZatcaCurrency(emp.tenant)) continue;

      const tenantId = emp.tenantId.toString();
      if (!alertsByTenant[tenantId]) {
        alertsByTenant[tenantId] = {
          tenant: emp.tenant,
          employees: []
        };
      }
      
      const daysRemaining = Math.ceil((new Date(emp.documents.expiryDate) - today) / (1000 * 60 * 60 * 24));
      
      alertsByTenant[tenantId].employees.push({
        employeeId: emp.employeeId,
        name: `${emp.firstNameEn} ${emp.lastNameEn}`,
        nameAr: `${emp.firstNameAr || ''} ${emp.lastNameAr || ''}`.trim(),
        iqamaNumber: emp.documents.number,
        expiryDate: emp.documents.expiryDate,
        expiryDateHijri: emp.documents.expiryDateHijri,
        daysRemaining,
        isExpired: daysRemaining <= 0
      });
      
      // Mark alert as sent
      await Employee.updateOne(
        { _id: emp._id, 'documents._id': emp.documents._id },
        { $set: { 'documents.$.alertSent': true } }
      );
    }
    
    // Send consolidated email per tenant
    for (const tenantId in alertsByTenant) {
      const { tenant, employees: emps } = alertsByTenant[tenantId];
      
      if (!tenant.business?.contactEmail) continue;
      
      const expiredCount = emps.filter(e => e.isExpired).length;
      const expiringCount = emps.length - expiredCount;
      
      const emailHtml = generateAlertEmail(tenant, emps, expiredCount, expiringCount);
      
      try {
        await transporter.sendMail({
          from: `"ZATCA ERP System" <${process.env.SMTP_USER}>`,
          to: tenant.business.contactEmail,
          subject: `⚠️ Iqama Expiry Alert - ${expiredCount + expiringCount} Employee(s) Require Attention`,
          html: emailHtml
        });
        
        logger.info(`Iqama alert email sent to ${tenant.business.contactEmail}`);
      } catch (emailError) {
        logger.error(`Failed to send Iqama alert email: ${emailError.message}`);
      }
    }
    
    return { success: true, alertsSent: Object.keys(alertsByTenant).length };
  } catch (error) {
    logger.error(`Iqama check failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function generateAlertEmail(tenant, employees, expiredCount, expiringCount) {
  const expiredRows = employees
    .filter(e => e.isExpired)
    .map(e => `
      <tr style="background-color: #FEE2E2;">
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">${e.employeeId}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">${e.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">${e.iqamaNumber}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">${new Date(e.expiryDate).toLocaleDateString('en-GB')}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; color: #DC2626; font-weight: bold;">EXPIRED</td>
      </tr>
    `).join('');
  
  const expiringRows = employees
    .filter(e => !e.isExpired)
    .map(e => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">${e.employeeId}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">${e.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">${e.iqamaNumber}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">${new Date(e.expiryDate).toLocaleDateString('en-GB')}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; color: #F59E0B; font-weight: bold;">${e.daysRemaining} days</td>
      </tr>
    `).join('');
  
  return `
    <!DOCTYPE html>
    <html dir="ltr">
    <head>
      <meta charset="UTF-8">
      <title>Iqama Expiry Alert</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #F3F4F6;">
      <div style="max-width: 800px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #0F766E 0%, #14B8A6 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Iqama Expiry Alert</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${tenant.business?.legalNameEn || tenant.name}</p>
        </div>
        
        <div style="padding: 30px;">
          <div style="display: flex; gap: 20px; margin-bottom: 30px;">
            ${expiredCount > 0 ? `
              <div style="flex: 1; background-color: #FEE2E2; border-radius: 8px; padding: 20px; text-align: center;">
                <div style="font-size: 36px; font-weight: bold; color: #DC2626;">${expiredCount}</div>
                <div style="color: #991B1B;">Expired</div>
              </div>
            ` : ''}
            ${expiringCount > 0 ? `
              <div style="flex: 1; background-color: #FEF3C7; border-radius: 8px; padding: 20px; text-align: center;">
                <div style="font-size: 36px; font-weight: bold; color: #F59E0B;">${expiringCount}</div>
                <div style="color: #92400E;">Expiring Soon</div>
              </div>
            ` : ''}
          </div>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background-color: #F9FAFB;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #E5E7EB;">Employee ID</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #E5E7EB;">Name</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #E5E7EB;">Iqama No.</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #E5E7EB;">Expiry Date</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #E5E7EB;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${expiredRows}
              ${expiringRows}
            </tbody>
          </table>
          
          <div style="margin-top: 30px; padding: 20px; background-color: #F0FDFA; border-radius: 8px; border-left: 4px solid #14B8A6;">
            <h3 style="margin: 0 0 10px 0; color: #0F766E;">Action Required</h3>
            <p style="margin: 0; color: #115E59;">Please initiate the renewal process for the above employees to avoid legal penalties and work disruptions.</p>
          </div>
        </div>
        
        <div style="background-color: #F9FAFB; padding: 20px; text-align: center; font-size: 12px; color: #6B7280;">
          <p style="margin: 0;">This is an automated alert from ZATCA ERP System</p>
          <p style="margin: 5px 0 0 0;">Generated on ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Riyadh' })}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export default checkIqamaExpiry;
