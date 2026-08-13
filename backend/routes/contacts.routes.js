import express from 'express';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import Employee from '../models/Employee.js';
import { WhatsAppContact } from '../models/WhatsApp.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';

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

    const customerMatch = {
      ...req.tenantFilter,
      ...activeMatch
    };

    if (q) {
      customerMatch.$or = [
        { name: { $regex: q, $options: 'i' } },
        { nameAr: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { mobile: { $regex: q, $options: 'i' } },
        { vatNumber: { $regex: q, $options: 'i' } }
      ];
    }

    const supplierMatch = {
      ...req.tenantFilter,
      ...activeMatch
    };

    if (q) {
      supplierMatch.$or = [
        { code: { $regex: q, $options: 'i' } },
        { nameEn: { $regex: q, $options: 'i' } },
        { nameAr: { $regex: q, $options: 'i' } },
        { vatNumber: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { contactPerson: { $regex: q, $options: 'i' } }
      ];
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

    const customerPipeline = [
      { $match: customerMatch },
      {
        $project: {
          _id: 0,
          entityType: { $literal: 'customer' },
          entityId: '$_id',
          displayName: '$name',
          displayNameAr: '$nameAr',
          email: '$email',
          phone: { $ifNull: ['$phone', '$mobile'] },
          vatNumber: '$vatNumber',
          code: { $literal: null },
          isActive: '$isActive',
          createdAt: '$createdAt',
          updatedAt: '$updatedAt'
        }
      }
    ];

    const supplierPipeline = [
      { $match: supplierMatch },
      {
        $project: {
          _id: 0,
          entityType: { $literal: 'supplier' },
          entityId: '$_id',
          displayName: '$nameEn',
          displayNameAr: '$nameAr',
          email: '$email',
          phone: '$phone',
          vatNumber: '$vatNumber',
          code: '$code',
          isActive: '$isActive',
          createdAt: '$createdAt',
          updatedAt: '$updatedAt'
        }
      }
    ];

    const employeePipeline = [
      { $match: employeeMatch },
      {
        $project: {
          _id: 0,
          entityType: { $literal: 'employee' },
          entityId: '$_id',
          displayName: {
            $trim: {
              input: { $concat: ['$firstNameEn', ' ', '$lastNameEn'] }
            }
          },
          displayNameAr: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ['$firstNameAr', ''] },
                  ' ',
                  { $ifNull: ['$lastNameAr', ''] }
                ]
              }
            }
          },
          email: '$email',
          phone: { $ifNull: ['$phone', '$alternatePhone'] },
          vatNumber: { $literal: null },
          code: '$employeeId',
          isActive: '$isActive',
          createdAt: '$createdAt',
          updatedAt: '$updatedAt'
        }
      }
    ];

    const sortField = (sortBy || 'displayName').toString();
    const sortDirection = (String(sortDir || 'asc').toLowerCase() === 'desc') ? -1 : 1;

    const sort = {};
    if (['displayName', 'createdAt', 'updatedAt', 'entityType'].includes(sortField)) {
      sort[sortField] = sortDirection;
      if (sortField !== 'displayName') sort.displayName = 1;
    } else {
      sort.displayName = 1;
    }

    const pageNum = Math.max(1, toInt(page, 1));
    const limitNum = Math.max(1, Math.min(200, toInt(limit, 50)));
    const skip = (pageNum - 1) * limitNum;

    const pipeline = [{ $match: { _id: null } }];

    if (wantCustomers) {
      pipeline.push({
        $unionWith: {
          coll: 'customers',
          pipeline: customerPipeline
        }
      });
    }

    if (wantSuppliers) {
      pipeline.push({
        $unionWith: {
          coll: 'suppliers',
          pipeline: supplierPipeline
        }
      });
    }

    if (wantEmployees) {
      pipeline.push({
        $unionWith: {
          coll: 'employees',
          pipeline: employeePipeline
        }
      });
    }

    pipeline.push(
      { $sort: sort },
      {
        $facet: {
          contacts: [{ $skip: skip }, { $limit: limitNum }],
          total: [{ $count: 'count' }]
        }
      }
    );

    const [result] = await Customer.aggregate(pipeline);

    let contacts = result?.contacts || [];
    let total = result?.total?.[0]?.count || 0;

    // Fetch WhatsApp contacts if requested
    if (wantWhatsApp) {
      const waQuery = { ...req.tenantFilter };
      if (q) {
        waQuery.$or = [
          { name: { $regex: q, $options: 'i' } },
          { phoneNumber: { $regex: q, $options: 'i' } },
          { formattedPhone: { $regex: q, $options: 'i' } }
        ];
      }
      const waContacts = await WhatsAppContact.find(waQuery)
        .select('name phoneNumber formattedPhone profileName isGroup groupId participantCount lastMessageAt totalMessages createdAt updatedAt')
        .sort({ name: 1 })
        .lean();

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
      total += mappedWa.length;

      // Re-sort combined results
      const sortFn = (a, b) => {
        const aName = (a.displayName || '').toString().toLowerCase();
        const bName = (b.displayName || '').toString().toLowerCase();
        return sortDirection * aName.localeCompare(bName);
      };
      contacts.sort(sortFn);

      // Re-paginate combined results
      contacts = contacts.slice(skip, skip + limitNum);
    }

    res.json({
      contacts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
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

    const [customers, suppliers, employees, waContacts, waGroups] = await Promise.all([
      access.customers ? Customer.countDocuments({ ...req.tenantFilter, ...activeMatch }) : 0,
      access.suppliers ? Supplier.countDocuments({ ...req.tenantFilter, ...activeMatch }) : 0,
      access.employees ? Employee.countDocuments({ ...req.tenantFilter, ...activeMatch }) : 0,
      WhatsAppContact.countDocuments({ ...req.tenantFilter, isGroup: false }),
      WhatsAppContact.countDocuments({ ...req.tenantFilter, isGroup: true })
    ]);

    res.json({
      total: customers + suppliers + employees + waContacts + waGroups,
      byType: {
        customers,
        suppliers,
        employees,
        whatsapp: waContacts,
        whatsappGroups: waGroups
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
