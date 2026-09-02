import express from 'express';
import Partner from '../models/Partner.js';
import Employee from '../models/Employee.js';
import { WhatsAppContact } from '../models/WhatsApp.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import { cacheAside } from '../lib/redis.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

const getIsActiveMatch = (isActive) => {
  if (isActive === 'false') return { isActive: false };
  if (isActive === 'all') return {};
  return { isActive: true };
};

const toInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const getAccess = (user) => {
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  return {
    isAdmin,
    customers: isAdmin || user?.hasPermission?.('invoicing', 'read'),
    suppliers: isAdmin || user?.hasPermission?.('supply_chain', 'read'),
    employees: isAdmin || user?.hasPermission?.('hr', 'read')
  };
};

const partnerSearchOr = (q) => [
  { name: { $regex: q, $options: 'i' } },
  { nameAr: { $regex: q, $options: 'i' } },
  { nameEn: { $regex: q, $options: 'i' } },
  { email: { $regex: q, $options: 'i' } },
  { phone: { $regex: q, $options: 'i' } },
  { mobile: { $regex: q, $options: 'i' } },
  { vatNumber: { $regex: q, $options: 'i' } },
  { crNumber: { $regex: q, $options: 'i' } },
  { customerCode: { $regex: q, $options: 'i' } },
  { supplierCode: { $regex: q, $options: 'i' } }
];

const mapPartner = (doc, { wantCustomers, wantSuppliers, wantEmployees }) => {
  const isCustomer = Boolean(doc.isCustomer);
  const isVendor = Boolean(doc.isVendor);
  const isEmployeePartner = Boolean(doc.isEmployee);

  let entityType;
  if (isEmployeePartner && !isCustomer && !isVendor) {
    entityType = 'employee';
  } else if (wantCustomers && !wantSuppliers && !wantEmployees) {
    entityType = 'customer';
  } else if (wantSuppliers && !wantCustomers && !wantEmployees) {
    entityType = 'supplier';
  } else if (wantEmployees && !wantCustomers && !wantSuppliers) {
    entityType = 'employee';
  } else {
    entityType = isCustomer ? 'customer' : (isVendor ? 'supplier' : (isEmployeePartner ? 'employee' : 'customer'));
  }

  return {
    entityType,
    entityId: String(doc._id),
    displayName: doc.name || doc.nameEn,
    displayNameAr: doc.nameAr,
    email: doc.email,
    phone: doc.phone || doc.mobile,
    vatNumber: doc.vatNumber,
    crNumber: doc.crNumber || '',
    address: doc.address || null,
    customerCode: doc.customerCode || null,
    supplierCode: doc.supplierCode || null,
    internalRef: doc.customerCode || doc.supplierCode || null,
    code: doc.supplierCode || doc.customerCode || null,
    isCustomer,
    isVendor,
    isEmployee: isEmployeePartner,
    isPartnerEmployee: isEmployeePartner,
    partnerType: doc.type || 'business',
    linkedSupplierId: null,
    linkedCustomerId: null,
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
};

router.get('/', async (req, res) => {
  try {
    const { search, types, isActive, sortBy, sortDir, page = 1, limit = 50 } = req.query;

    const access = getAccess(req.user);

    if (!access.customers && !access.suppliers && !access.employees) {
      return res.status(403).json({ error: 'Not authorized to read contacts' });
    }

    const requestedTypes = (types ? String(types) : '')
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    const wantCustomers = (requestedTypes.length === 0 || requestedTypes.includes('customer') || requestedTypes.includes('customers')) && access.customers;
    const wantSuppliers = (requestedTypes.length === 0 || requestedTypes.includes('supplier') || requestedTypes.includes('suppliers')) && access.suppliers;
    const wantEmployees = (requestedTypes.length === 0 || requestedTypes.includes('employee') || requestedTypes.includes('employees')) && access.employees;
    const wantWhatsApp = (requestedTypes.length === 0 || requestedTypes.includes('whatsapp'));

    if (!wantCustomers && !wantSuppliers && !wantEmployees && !wantWhatsApp) {
      return res.json({
        contacts: [],
        pagination: { page: toInt(page, 1), limit: toInt(limit, 50), total: 0, pages: 0 }
      });
    }

    const activeMatch = getIsActiveMatch(isActive);
    const q = (search || '').trim();

    const partnerMatch = {
      ...req.tenantFilter,
      ...activeMatch
    };

    const isPartnerHub = requestedTypes.includes('customer')
      && requestedTypes.includes('supplier')
      && !requestedTypes.includes('employee');

    const partnerRoleOr = [];
    if (wantCustomers) partnerRoleOr.push({ isCustomer: true });
    if (wantSuppliers) partnerRoleOr.push({ isVendor: true });
    if (wantEmployees || isPartnerHub) partnerRoleOr.push({ isEmployee: true });

    if (partnerRoleOr.length === 1) {
      Object.assign(partnerMatch, partnerRoleOr[0]);
    } else if (partnerRoleOr.length > 1) {
      partnerMatch.$or = partnerRoleOr;
    } else if (wantEmployees) {
      partnerMatch.isEmployee = true;
    }

    if (q && partnerRoleOr.length) {
      const searchOr = partnerSearchOr(q);
      if (partnerMatch.$or) {
        partnerMatch.$and = [{ $or: partnerMatch.$or }, { $or: searchOr }];
        delete partnerMatch.$or;
      } else {
        partnerMatch.$or = searchOr;
      }
    }

    const employeeMatch = {
      ...req.tenantFilter,
      ...activeMatch
    };

    if (q) {
      employeeMatch.$or = [
        { employeeId: { $regex: q, $options: 'i' } },
        { firstNameEn: { $regex: q, $options: 'i' } },
        { lastNameEn: { $regex: q, $options: 'i' } },
        { firstNameAr: { $regex: q, $options: 'i' } },
        { lastNameAr: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } }
      ];
    }

    const sortDirection = (String(sortDir || 'asc').toLowerCase() === 'desc') ? -1 : 1;

    const mapEmployee = (doc) => ({
      entityType: 'employee',
      entityId: String(doc._id),
      displayName: `${doc.firstNameEn || ''} ${doc.lastNameEn || ''}`.trim(),
      displayNameAr: `${doc.firstNameAr || ''} ${doc.lastNameAr || ''}`.trim(),
      email: doc.email,
      phone: doc.phone || doc.alternatePhone,
      vatNumber: null,
      code: doc.employeeId,
      isActive: doc.isActive !== false,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });

    const pageNum = Math.max(1, toInt(page, 1));
    const limitNum = Math.max(1, Math.min(200, toInt(limit, 50)));
    const skip = (pageNum - 1) * limitNum;
    const fetchCap = Math.min(500, skip + limitNum + 100);

    const cacheKey = `contacts:v6:${req.user.tenantId}:${pageNum}:${limitNum}:${q}:${types || ''}:${isActive || ''}:${sortBy || ''}:${sortDir || ''}`;

    const payload = await cacheAside(cacheKey, 45, async () => {
    const wantPartners = (wantCustomers && access.customers)
      || (wantSuppliers && access.suppliers)
      || (wantEmployees && access.employees)
      || (isPartnerHub && (access.customers || access.suppliers));

    const fetchHrEmployees = wantEmployees && !isPartnerHub;

    const [partnerDocs, employeeDocs, partnerTotal, employeeTotal] = await Promise.all([
      wantPartners
        ? Partner.find(partnerMatch)
          .select('name nameEn nameAr email phone mobile vatNumber crNumber address customerCode supplierCode isActive isCustomer isVendor isEmployee type createdAt updatedAt')
          .sort({ name: 1 })
          .limit(fetchCap)
          .lean()
        : [],
      fetchHrEmployees
        ? Employee.find(employeeMatch).select('employeeId firstNameEn lastNameEn firstNameAr lastNameAr email phone alternatePhone isActive createdAt updatedAt').sort({ firstNameEn: 1 }).limit(fetchCap).lean()
        : [],
      wantPartners ? Partner.countDocuments(partnerMatch) : 0,
      fetchHrEmployees ? Employee.countDocuments(employeeMatch) : 0,
    ]);

    let contacts = [
      ...partnerDocs.map((doc) => mapPartner(doc, { wantCustomers, wantSuppliers, wantEmployees: wantEmployees || isPartnerHub })),
      ...employeeDocs.map(mapEmployee)
    ];
    let total = (partnerTotal || 0) + (employeeTotal || 0);

    if (wantWhatsApp) {
      const waQuery = { ...req.tenantFilter };
      if (q) {
        waQuery.$or = [
          { name: { $regex: q, $options: 'i' } },
          { phoneNumber: { $regex: q, $options: 'i' } },
          { formattedPhone: { $regex: q, $options: 'i' } }
        ];
      }
      const [waContacts, waTotal] = await Promise.all([
        WhatsAppContact.find(waQuery)
          .select('name phoneNumber formattedPhone profileName isGroup groupId participantCount lastMessageAt totalMessages createdAt updatedAt')
          .sort({ name: 1 })
          .limit(fetchCap)
          .lean(),
        WhatsAppContact.countDocuments(waQuery),
      ]);

      const mappedWa = waContacts.map((c) => ({
        entityType: c.isGroup ? 'whatsapp_group' : 'whatsapp',
        entityId: c._id.toString(),
        displayName: c.name || c.formattedPhone || c.phoneNumber || 'Unknown',
        displayNameAr: null,
        email: null,
        phone: c.isGroup ? `Group: ${c.participantCount || '?'} members` : (c.formattedPhone || c.phoneNumber),
        vatNumber: null,
        code: c.isGroup ? 'GROUP' : 'WA',
        isActive: true,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        _wa: { isGroup: c.isGroup, groupId: c.groupId, lastMessageAt: c.lastMessageAt, totalMessages: c.totalMessages }
      }));

      contacts = contacts.concat(mappedWa);
      total += waTotal || 0;
    }

    const sortFn = (a, b) => {
      const aName = (a.displayName || '').toString().toLowerCase();
      const bName = (b.displayName || '').toString().toLowerCase();
      return sortDirection * aName.localeCompare(bName);
    };
    contacts.sort(sortFn);
    contacts = contacts.slice(skip, skip + limitNum);

    return {
      contacts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 0,
      },
    };
    }, { staleTtlSeconds: 180, fetchTimeoutMs: 12_000 });

    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const { isActive } = req.query;

    const access = getAccess(req.user);

    if (!access.customers && !access.suppliers && !access.employees) {
      return res.status(403).json({ error: 'Not authorized to read contacts' });
    }

    const activeMatch = getIsActiveMatch(isActive);
    const base = { ...req.tenantFilter, ...activeMatch };

    const [customers, suppliers, partners, partnerEmployees, employees, waContacts, waGroups] = await Promise.all([
      access.customers ? Partner.countDocuments({ ...base, isCustomer: true }) : 0,
      access.suppliers ? Partner.countDocuments({ ...base, isVendor: true }) : 0,
      (access.customers || access.suppliers || access.employees)
        ? Partner.countDocuments({
            ...base,
            $or: [
              ...(access.customers ? [{ isCustomer: true }] : []),
              ...(access.suppliers ? [{ isVendor: true }] : []),
              ...(access.employees ? [{ isEmployee: true }] : []),
            ],
          })
        : 0,
      access.employees ? Partner.countDocuments({ ...base, isEmployee: true }) : 0,
      access.employees ? Employee.countDocuments({ ...req.tenantFilter, ...activeMatch }) : 0,
      WhatsAppContact.countDocuments({ ...req.tenantFilter, isGroup: false }),
      WhatsAppContact.countDocuments({ ...req.tenantFilter, isGroup: true })
    ]);

    res.json({
      total: partners + employees + waContacts + waGroups,
      byType: {
        customers,
        suppliers,
        partners,
        partnerEmployees,
        employees,
        whatsapp: waContacts,
        whatsappGroups: waGroups
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** No-op: partners are already merged on a single collection. */
router.post('/backfill-dual-role', async (req, res) => {
  try {
    const access = getAccess(req.user);
    if (!access.isAdmin) {
      return res.status(403).json({ error: 'Admin only' });
    }
    const tenantId = req.tenantFilter?.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId required' });
    }
    res.json({ alreadyMerged: true, customersSynced: 0, suppliersSynced: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
