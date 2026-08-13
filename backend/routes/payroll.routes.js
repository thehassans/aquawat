import express from 'express';
import Employee from '../models/Employee.js';
import Payroll from '../models/Payroll.js';
import { protect, tenantFilter, checkPermission, requireTenantFilter } from '../middleware/auth.js';
import { calculateGOSI, calculateEOSB, generateWPSSIFFile, convertToHijri } from '../utils/hr/payrollCalculations.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

// @route   GET /api/payroll
router.get('/', checkPermission('payroll', 'read'), async (req, res) => {
  try {
    const { month, year, status, page = 1, limit = 50 } = req.query;
    
    const query = { ...req.tenantFilter };
    if (month) query.periodMonth = parseInt(month);
    if (year) query.periodYear = parseInt(year);
    if (status) query.status = status;
    
    const payrolls = await Payroll.find(query)
      .populate('employeeId', 'employeeId firstNameEn lastNameEn nationality department')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Payroll.countDocuments(query);
    
    res.json({
      payrolls,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/payroll/calculate-gosi
router.post('/calculate-gosi', checkPermission('payroll', 'read'), async (req, res) => {
  try {
    const { salary, nationality, dateOfBirth, asOfDate } = req.body;
    const result = calculateGOSI(salary, nationality, { dateOfBirth, asOfDate });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/payroll/calculate-eosb
router.post('/calculate-eosb', checkPermission('payroll', 'read'), async (req, res) => {
  try {
    const { yearsService, lastSalary, terminationReason } = req.body;
    const result = calculateEOSB(yearsService, lastSalary, terminationReason);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/payroll/calculate-eosb/:employeeId
router.post('/calculate-eosb/:employeeId', checkPermission('payroll', 'read'), async (req, res) => {
  try {
    const { terminationReason } = req.body;
    
    const employee = await Employee.findOne({
      _id: req.params.employeeId,
      ...req.tenantFilter
    });
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    const yearsService = employee.yearsOfService;
    const lastSalary = employee.totalSalary;
    
    const result = calculateEOSB(yearsService, lastSalary, terminationReason);
    
    res.json({
      employee: {
        id: employee._id,
        name: employee.fullNameEn,
        employeeId: employee.employeeId,
        joinDate: employee.joinDate,
        yearsOfService: yearsService
      },
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/payroll/generate
router.post('/generate', checkPermission('payroll', 'create'), async (req, res) => {
  try {
    const { month, year, employeeIds } = req.body;
    
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);
    
    let employeeQuery = { ...req.tenantFilter, status: 'active', isActive: true };
    if (employeeIds?.length) {
      employeeQuery._id = { $in: employeeIds };
    }
    
    const employees = await Employee.find(employeeQuery);
    const payrolls = [];
    
    for (const employee of employees) {
      // Check if payroll already exists
      const existing = await Payroll.findOne({
        tenantId: req.user.tenantId,
        employeeId: employee._id,
        periodMonth: month,
        periodYear: year
      });
      
      if (existing) continue;
      
      const salary = employee.currentSalary || {};
      const gosiBase =
        (salary.basicSalary || 0) +
        (salary.housingAllowance || 0) +
        (salary.transportAllowance || 0) +
        (salary.foodAllowance || 0) +
        (salary.otherAllowances || 0);
      const gosi = calculateGOSI(gosiBase, employee.nationality, { dateOfBirth: employee.dateOfBirth, asOfDate: periodEnd });
      
      const earnings = [
        { type: 'basic', description: 'Basic Salary', descriptionAr: 'الراتب الأساسي', amount: salary.basicSalary || 0 },
        { type: 'housing', description: 'Housing Allowance', descriptionAr: 'بدل السكن', amount: salary.housingAllowance || 0 },
        { type: 'transport', description: 'Transport Allowance', descriptionAr: 'بدل النقل', amount: salary.transportAllowance || 0 },
        { type: 'food', description: 'Food Allowance', descriptionAr: 'بدل الطعام', amount: salary.foodAllowance || 0 },
        { type: 'other', description: 'Other Allowances', descriptionAr: 'بدلات أخرى', amount: salary.otherAllowances || 0 }
      ].filter(e => e.amount > 0);
      
      const deductions = [
        { type: 'gosi_employee', description: 'GOSI Employee Share', descriptionAr: 'حصة الموظف - التأمينات', amount: gosi.employeeShare }
      ].filter(d => d.amount > 0);
      
      const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
      const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
      
      const payroll = await Payroll.create({
        tenantId: req.user.tenantId,
        employeeId: employee._id,
        periodMonth: month,
        periodYear: year,
        periodStart,
        periodEnd,
        earnings,
        deductions,
        totalEarnings,
        totalDeductions,
        gosi: {
          employeeShare: gosi.employeeShare,
          employerShare: gosi.employerShare,
          totalContribution: gosi.totalContribution,
          calculationBase: gosi.cappedSalary
        },
        grossPay: totalEarnings,
        netPay: totalEarnings - totalDeductions,
        status: 'draft',
        createdBy: req.user._id
      });
      
      payrolls.push(payroll);
    }
    
    res.status(201).json({
      message: `Generated ${payrolls.length} payroll records`,
      payrolls
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/payroll/generate-wps
router.post('/generate-wps', checkPermission('payroll', 'export'), async (req, res) => {
  try {
    const { month, year, paymentDate } = req.body;
    
    const payrolls = await Payroll.find({
      ...req.tenantFilter,
      periodMonth: month,
      periodYear: year,
      status: 'approved'
    }).populate('employeeId');
    
    if (!payrolls.length) {
      return res.status(400).json({ error: 'No approved payrolls found for the specified period' });
    }
    
    const tenant = req.tenant;
    
    const companyInfo = {
      bankCode: tenant.business?.bankCode || '10',
      molId: tenant.business?.molId || tenant.business?.crNumber,
      reference: `WPS-${year}${String(month).padStart(2, '0')}`,
      fileSerial: Date.now()
    };
    
    const employees = payrolls.map(p => ({
      employeeId: p.employeeId.employeeId,
      employeeName: `${p.employeeId.firstNameEn} ${p.employeeId.lastNameEn}`,
      iqamaNumber: p.employeeId.documents?.find(d => d.type === 'iqama')?.number || '',
      nationality: p.employeeId.nationality,
      iban: p.employeeId.bankDetails?.iban || '',
      bankCode: p.employeeId.bankDetails?.bankCode || '',
      netPay: p.netPay,
      basicSalary: p.earnings.find(e => e.type === 'basic')?.amount || 0,
      housingAllowance: p.earnings.find(e => e.type === 'housing')?.amount || 0,
      otherAllowances: p.earnings.filter(e => !['basic', 'housing'].includes(e.type)).reduce((sum, e) => sum + e.amount, 0),
      totalDeductions: p.totalDeductions
    }));
    
    const sifContent = generateWPSSIFFile(companyInfo, employees, paymentDate || new Date());
    
    // Mark payrolls as included in WPS
    const batchId = `WPS-${Date.now()}`;
    await Payroll.updateMany(
      { _id: { $in: payrolls.map(p => p._id) } },
      { 'wps.included': true, 'wps.batchId': batchId, 'wps.processedAt': new Date() }
    );
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="WPS_${year}${String(month).padStart(2, '0')}.sif"`);
    res.send(sifContent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/payroll/:id/approve
router.put('/:id/approve', checkPermission('payroll', 'approve'), async (req, res) => {
  try {
    const payroll = await Payroll.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter, status: { $in: ['draft', 'pending_approval'] } },
      { status: 'approved', approvedBy: req.user._id, approvedAt: new Date() },
      { new: true }
    );
    
    if (!payroll) {
      return res.status(404).json({ error: 'Payroll not found or already processed' });
    }
    
    res.json(payroll);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/payroll/:id/pay
router.put('/:id/pay', checkPermission('payroll', 'approve'), async (req, res) => {
  try {
    const { paymentMethod, paymentReference } = req.body;
    
    const payroll = await Payroll.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter, status: 'approved' },
      { status: 'paid', paymentMethod, paymentReference, paymentDate: new Date() },
      { new: true }
    );
    
    if (!payroll) {
      return res.status(404).json({ error: 'Payroll not found or not approved' });
    }
    
    res.json(payroll);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/payroll/summary
router.get('/summary', checkPermission('payroll', 'read'), async (req, res) => {
  try {
    const { year } = req.query;
    
    const summary = await Payroll.aggregate([
      { $match: { ...req.tenantFilter, periodYear: parseInt(year) || new Date().getFullYear() } },
      {
        $group: {
          _id: '$periodMonth',
          totalGross: { $sum: '$grossPay' },
          totalNet: { $sum: '$netPay' },
          totalGOSI: { $sum: '$gosi.totalContribution' },
          employeeCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/payroll/convert-date
router.post('/convert-date', async (req, res) => {
  try {
    const { date, type } = req.body;
    
    if (type === 'hijri') {
      const result = convertFromHijri(date);
      res.json(result);
    } else {
      const result = convertToHijri(date);
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
