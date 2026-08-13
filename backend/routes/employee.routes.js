import express from 'express';
import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import Tenant from '../models/Tenant.js';
import SystemSettings from '../models/SystemSettings.js';
import { protect, tenantFilter, checkPermission, checkEmailAddon, requireTenantFilter } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import { sendTenantEmail } from '../utils/tenantEmailService.js';
import { describeSaudiId, normalizeSaudiId } from '../utils/saudiId.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

function getSaudiIdentityDocument(documents) {
  if (!Array.isArray(documents)) return null;
  return documents.find((doc) => doc?.type === 'national_id' || doc?.type === 'iqama') || null;
}

function getEmployeeDisplayName(employee = {}) {
  return [employee?.firstNameEn, employee?.lastNameEn].filter(Boolean).join(' ').trim()
    || [employee?.firstNameAr, employee?.lastNameAr].filter(Boolean).join(' ').trim()
    || employee?.employeeId
    || '';
}

function buildDuplicateMeta(employee = null) {
  if (!employee) {
    return {
      exists: false,
    };
  }

  return {
    exists: true,
    employeeRecordId: String(employee?._id || ''),
    employeeId: employee?.employeeId || '',
    employeeName: getEmployeeDisplayName(employee),
  };
}

function buildLookupDetailsFromEmployee(employee = null) {
  if (!employee) return null;

  const saudiDocument = getSaudiIdentityDocument(employee?.documents);

  return {
    employeeId: employee.employeeId,
    firstNameEn: employee.firstNameEn,
    lastNameEn: employee.lastNameEn,
    firstNameAr: employee.firstNameAr,
    lastNameAr: employee.lastNameAr,
    email: employee.email,
    phone: employee.phone,
    alternatePhone: employee.alternatePhone,
    dateOfBirth: employee.dateOfBirth,
    nationality: employee.nationality,
    gender: employee.gender,
    maritalStatus: employee.maritalStatus,
    bloodGroup: employee.bloodGroup,
    nationalIdIssueDate: employee.nationalIdIssueDate || saudiDocument?.issueDate,
    nationalIdExpiry: employee.nationalIdExpiry || saudiDocument?.expiryDate,
    idCardFront: employee.idCardFront,
    idCardBack: employee.idCardBack,
    insurance: employee.insurance,
    address: employee.address,
  };
}

function getIdentityIntegrationSettings(tenant = {}) {
  const saudiIntegrations = tenant?.settings?.saudiIntegrations || {};
  const identity = saudiIntegrations?.identity || {};
  const hasLocalConfig = Boolean(
    String(identity?.endpoint || '').trim()
    || String(identity?.apiKey || '').trim()
    || identity?.enabled === true
    || identity?.ocrEnabled === true
  );

  return {
    enabled: saudiIntegrations?.enabled !== false && identity?.enabled === true,
    provider: String(identity?.provider || 'custom_webhook').trim() || 'custom_webhook',
    endpoint: String(identity?.endpoint || '').trim(),
    apiKey: String(identity?.apiKey || '').trim(),
    ocrEnabled: identity?.ocrEnabled === true,
    hasLocalConfig,
    saudiIntegrationEnabled: saudiIntegrations?.enabled !== false,
  };
}

async function getEffectiveIdentityIntegrationSettings(tenant = {}) {
  const tenantSettings = getIdentityIntegrationSettings(tenant);
  if (tenantSettings.hasLocalConfig) {
    return tenantSettings;
  }

  const globalSettings = await SystemSettings.findOne({ key: 'global' }).select('identity');
  const globalIdentity = globalSettings?.identity?.toObject?.() || globalSettings?.identity || {};

  return {
    enabled: tenantSettings.saudiIntegrationEnabled && globalIdentity?.enabled === true,
    provider: String(globalIdentity?.provider || tenantSettings.provider || 'custom_webhook').trim() || 'custom_webhook',
    endpoint: String(globalIdentity?.endpoint || '').trim(),
    apiKey: String(globalIdentity?.apiKey || '').trim(),
    ocrEnabled: globalIdentity?.ocrEnabled === true,
    hasLocalConfig: false,
    saudiIntegrationEnabled: tenantSettings.saudiIntegrationEnabled,
  };
}

async function runIdentityProviderLookup({ tenant, mode = 'id', nationalId = '', idCardFront = '', idCardBack = '', language = 'en' }) {
  const settings = await getEffectiveIdentityIntegrationSettings(tenant);

  if (!settings.enabled || !settings.endpoint) {
    return {
      providerAvailable: false,
      configured: false,
      details: null,
      message: 'Identity provider is not configured',
    };
  }

  if (mode === 'ocr' && !settings.ocrEnabled) {
    return {
      providerAvailable: false,
      configured: true,
      details: null,
      message: 'Identity OCR is not enabled',
    };
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  if (settings.apiKey) {
    headers.Authorization = `Bearer ${settings.apiKey}`;
  }

  const response = await fetch(settings.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      mode,
      language,
      nationalId: normalizeSaudiId(nationalId),
      images: {
        front: typeof idCardFront === 'string' ? idCardFront : '',
        back: typeof idCardBack === 'string' ? idCardBack : '',
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || 'Identity provider request failed');
  }

  const details = payload?.details && typeof payload.details === 'object'
    ? payload.details
    : payload?.lookup && typeof payload.lookup === 'object'
      ? payload.lookup
      : payload && typeof payload === 'object'
        ? payload
        : null;

  return {
    providerAvailable: true,
    configured: true,
    details,
    message: payload?.message || 'Identity details returned by provider',
  };
}

async function findEmployeeBySaudiId({ tenantFilterValue, normalizedId, excludeEmployeeId }) {
  if (!normalizedId) return null;

  const query = {
    ...tenantFilterValue,
    $or: [
      { nationalId: normalizedId },
      { 'documents.number': normalizedId },
    ],
  };

  if (excludeEmployeeId && mongoose.isValidObjectId(excludeEmployeeId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeEmployeeId) };
  }

  return await Employee.findOne(query).select([
    'employeeId',
    'firstNameEn',
    'lastNameEn',
    'firstNameAr',
    'lastNameAr',
    'email',
    'phone',
    'alternatePhone',
    'dateOfBirth',
    'nationality',
    'gender',
    'maritalStatus',
    'bloodGroup',
    'nationalId',
    'nationalIdIssueDate',
    'nationalIdExpiry',
    'idCardFront',
    'idCardBack',
    'documents',
    'insurance',
    'address',
  ].join(' '));
}

// @route   GET /api/employees
router.get('/', checkPermission('hr', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, nationality, department, search } = req.query;
    
    const query = { ...req.tenantFilter };
    
    if (status) query.status = status;
    if (nationality) query.nationality = nationality;
    if (department) query.department = department;
    if (search) {
      query.$or = [
        { firstNameEn: { $regex: search, $options: 'i' } },
        { lastNameEn: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const [employeesData, total] = await Promise.all([
      Employee.find(query)
        .select('-documents.fileUrl -salaryHistory -idCardProof -idCardFront -idCardBack')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      Employee.countDocuments(query),
    ]);

    // .lean() skips schema virtuals (fullNameEn/Ar, totalSalary, yearsOfService)
    // that the frontend relies on — recompute them manually to preserve parity.
    const employees = employeesData.map((e) => {
      const s = e.currentSalary;
      const totalSalary = s
        ? (s.basicSalary || 0) + (s.housingAllowance || 0) + (s.transportAllowance || 0) + (s.foodAllowance || 0) + (s.otherAllowances || 0)
        : 0;
      const endDate = e.terminationDate || new Date();
      const yearsOfService = e.joinDate ? Math.round(((endDate - e.joinDate) / (365.25 * 24 * 60 * 60 * 1000)) * 100) / 100 : 0;
      return {
        ...e,
        fullNameEn: `${e.firstNameEn || ''} ${e.lastNameEn || ''}`.trim(),
        fullNameAr: `${e.firstNameAr || ''} ${e.lastNameAr || ''}`.trim(),
        totalSalary,
        yearsOfService,
      };
    });

    res.json({
      employees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/employees/stats
router.get('/stats', checkPermission('hr', 'read'), async (req, res) => {
  try {
    const stats = await Employee.aggregate([
      { $match: { ...req.tenantFilter, isActive: true } },
      {
        $facet: {
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          byNationality: [
            { $group: { _id: '$nationality', count: { $sum: 1 } } }
          ],
          byDepartment: [
            { $group: { _id: '$department', count: { $sum: 1 } } }
          ],
          expiringDocuments: [
            {
              $project: {
                expiryCandidates: {
                  $concatArrays: [
                    {
                      $map: {
                        input: { $ifNull: ['$documents', []] },
                        as: 'doc',
                        in: {
                          expiryDate: '$$doc.expiryDate',
                        }
                      }
                    },
                    {
                      $cond: [
                        {
                          $and: [
                            { $eq: ['$nationalIdType', 'iqama'] },
                            { $ne: ['$nationalIdExpiry', null] },
                          ]
                        },
                        [{ expiryDate: '$nationalIdExpiry' }],
                        []
                      ]
                    }
                  ]
                }
              }
            },
            { $unwind: '$expiryCandidates' },
            {
              $match: {
                'expiryCandidates.expiryDate': {
                  $lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
                }
              }
            },
            { $count: 'count' }
          ],
          totalEmployees: [
            { $count: 'count' }
          ]
        }
      }
    ]);
    
    res.json(stats[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/lookup-saudi-id', checkPermission('hr', 'read'), async (req, res) => {
  try {
    const normalizedId = normalizeSaudiId(req.body?.nationalId);
    const saudiIdMeta = describeSaudiId(normalizedId);
    const excludeEmployeeId = String(req.body?.excludeEmployeeId || '').trim();

    if (!normalizedId) {
      return res.status(400).json({ error: 'National ID / Iqama is required' });
    }

    if (!saudiIdMeta.valid || !saudiIdMeta.type) {
      return res.status(400).json({
        error: 'Invalid Saudi National ID / Iqama',
        lookup: {
          nationalId: normalizedId,
          ...saudiIdMeta,
          source: 'validation_only',
          providerAvailable: false,
          duplicate: { exists: false },
          details: null,
        },
      });
    }

    const employee = await findEmployeeBySaudiId({
      tenantFilterValue: req.tenantFilter,
      normalizedId,
      excludeEmployeeId,
    });
    const duplicate = buildDuplicateMeta(employee);

    let providerLookup = {
      providerAvailable: false,
      configured: false,
      details: null,
      message: 'Identity provider is not configured',
    };

    if (!employee) {
      const tenant = await Tenant.findById(req.user.tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      providerLookup = await runIdentityProviderLookup({
        tenant,
        mode: 'id',
        nationalId: normalizedId,
        language: req.body?.language === 'ar' ? 'ar' : 'en',
      });
    }

    const providerDetails = providerLookup?.details && typeof providerLookup.details === 'object' ? providerLookup.details : null;

    res.json({
      lookup: {
        nationalId: normalizedId,
        ...saudiIdMeta,
        source: employee ? 'tenant_records' : providerDetails ? 'provider_live' : 'validation_only',
        providerAvailable: providerLookup.providerAvailable === true,
        duplicate,
        details: employee ? buildLookupDetailsFromEmployee(employee) : providerDetails,
        message: employee
          ? 'Details found from existing employee records'
          : providerDetails
            ? providerLookup.message || 'Identity details returned by provider'
            : providerLookup.message || 'ID validated, but no saved details were found in tenant records',
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/lookup-saudi-id-images', checkPermission('hr', 'read'), async (req, res) => {
  try {
    const idCardFront = String(req.body?.idCardFront || '').trim();
    const idCardBack = String(req.body?.idCardBack || '').trim();
    const fallbackNationalId = normalizeSaudiId(req.body?.nationalId);
    const excludeEmployeeId = String(req.body?.excludeEmployeeId || '').trim();

    if (!idCardFront && !idCardBack) {
      return res.status(400).json({ error: 'At least one ID image is required' });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const providerLookup = await runIdentityProviderLookup({
      tenant,
      mode: 'ocr',
      nationalId: fallbackNationalId,
      idCardFront,
      idCardBack,
      language: req.body?.language === 'ar' ? 'ar' : 'en',
    });

    const providerDetails = providerLookup?.details && typeof providerLookup.details === 'object' ? providerLookup.details : null;
    const normalizedId = normalizeSaudiId(providerDetails?.nationalId || fallbackNationalId);
    const saudiIdMeta = describeSaudiId(normalizedId);
    const duplicateEmployee = normalizedId
      ? await findEmployeeBySaudiId({
          tenantFilterValue: req.tenantFilter,
          normalizedId,
          excludeEmployeeId,
        })
      : null;

    res.json({
      lookup: {
        nationalId: normalizedId || undefined,
        ...saudiIdMeta,
        source: providerDetails ? 'provider_ocr' : 'ocr_unavailable',
        providerAvailable: providerLookup.providerAvailable === true,
        duplicate: buildDuplicateMeta(duplicateEmployee),
        details: providerDetails,
        message: providerLookup.message || 'No OCR details were returned',
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/employees/compliance/alerts
router.get('/compliance/alerts', checkPermission('hr', 'read'), async (req, res) => {
  try {
    const employees = await Employee.find({ ...req.tenantFilter, isActive: true })
      .select('firstNameEn lastNameEn firstNameAr lastNameAr employeeId nationalIdType nationalIdExpiry documents');
    
    const alerts = [];
    const today = new Date();
    const thresholdDays = 60;
    const thresholdDate = new Date();
    thresholdDate.setDate(today.getDate() + thresholdDays);

    employees.forEach(emp => {
      // Check Iqama Expiry
      if (emp.nationalIdType === 'iqama' && emp.nationalIdExpiry) {
        const expiryDate = new Date(emp.nationalIdExpiry);
        if (expiryDate <= thresholdDate) {
          alerts.push({
            employeeId: emp._id,
            employeeCode: emp.employeeId,
            name: `${emp.firstNameEn} ${emp.lastNameEn}`,
            documentType: 'Iqama',
            expiryDate: emp.nationalIdExpiry,
            daysRemaining: Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24)),
            isExpired: expiryDate < today
          });
        }
      }
      
      // Check Other Documents
      if (emp.documents && emp.documents.length > 0) {
        emp.documents.forEach(doc => {
          if (doc.expiryDate) {
            const expiryDate = new Date(doc.expiryDate);
            if (expiryDate <= thresholdDate) {
              alerts.push({
                employeeId: emp._id,
                employeeCode: emp.employeeId,
                name: `${emp.firstNameEn} ${emp.lastNameEn}`,
                documentType: doc.type === 'balady_certificate' ? 'Balady Certificate' : doc.type.replace('_', ' '),
                documentNumber: doc.number,
                expiryDate: doc.expiryDate,
                daysRemaining: Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24)),
                isExpired: expiryDate < today
              });
            }
          }
        });
      }
    });

    alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/employees/:id
router.get('/:id', checkPermission('hr', 'read'), async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      ...req.tenantFilter
    }).populate('manager', 'firstNameEn lastNameEn employeeId');
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/employees
router.post('/', checkTrialLimits('employees'), checkPermission('hr', 'create'), async (req, res) => {
  try {
    const employeeData = {
      ...req.body,
      tenantId: req.user.tenantId
    };
    
    const employee = await Employee.create(employeeData);
    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/employees/:id
router.put('/:id', checkPermission('hr', 'update'), async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      ...req.tenantFilter
    });
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    Object.assign(employee, req.body);
    await employee.save();
    
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/employees/:id/documents
router.post('/:id/documents', checkPermission('hr', 'update'), async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      ...req.tenantFilter
    });
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    employee.documents.push(req.body);
    await employee.save();
    
    res.status(201).json(employee.documents[employee.documents.length - 1]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/employees/:id/salary
router.put('/:id/salary', checkPermission('hr', 'update'), async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      ...req.tenantFilter
    });
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    // Archive current salary
    if (employee.currentSalary) {
      employee.salaryHistory.push(employee.currentSalary);
    }
    
    employee.currentSalary = {
      ...req.body,
      effectiveDate: req.body.effectiveDate || new Date()
    };
    
    await employee.save();
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/employees/:id/terminate
router.post('/:id/terminate', checkPermission('hr', 'update'), async (req, res) => {
  try {
    const { terminationDate, terminationReason } = req.body;
    
    const employee = await Employee.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      {
        status: 'terminated',
        terminationDate,
        terminationReason,
        isActive: false
      },
      { new: true }
    );
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/employees/:id/expiring-documents
router.get('/:id/expiring-documents', checkPermission('hr', 'read'), async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      ...req.tenantFilter
    });
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 60);
    
    const expiringDocs = employee.documents.filter(doc => {
      return doc.expiryDate && new Date(doc.expiryDate) <= thirtyDaysFromNow;
    });
    
    res.json(expiringDocs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/employees/:id/send-email
// Send a custom email to a specific employee via the tenant's email service
router.post('/:id/send-email', checkPermission('hr', 'read'), checkEmailAddon, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, ...req.tenantFilter }).lean();
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const recipientEmail = employee.email;
    if (!recipientEmail) return res.status(400).json({ error: 'Employee has no email address on file' });

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const { subject, bodyHtml, bodyText, attachments } = req.body || {};
    if (!subject || !String(subject).trim()) return res.status(400).json({ error: 'Subject is required' });

    const employeeName = [employee.firstNameEn, employee.lastNameEn].filter(Boolean).join(' ').trim()
      || [employee.firstNameAr, employee.lastNameAr].filter(Boolean).join(' ').trim()
      || employee.employeeId || '';

    const delivery = await sendTenantEmail({
      tenant,
      to: [{ email: recipientEmail, name: employeeName }],
      subject: String(subject).trim(),
      html: bodyHtml || `<p>${String(bodyText || '').replace(/\n/g, '<br>')}</p>`,
      text: bodyText || '',
      attachments: Array.isArray(attachments) ? attachments : [],
      metadata: {
        purpose: 'employee_email',
        employeeId: String(employee._id),
        sentBy: String(req.user._id),
      },
    });

    res.status(201).json({ success: true, delivery, recipientEmail, employeeName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
