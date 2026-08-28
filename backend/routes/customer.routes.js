import express from 'express';
import mongoose from 'mongoose';
import Customer from '../models/Customer.js';
import { protect, tenantFilter, checkPermission, authorize, requireTenantFilter } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import {
  asCustomerQuery,
  fromCustomerBody,
  toCustomerDto,
  nextCustomerCode,
} from '../services/partnerService.js';
import { cachedTenantStats } from '../utils/statsCache.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

// @route   GET /api/customers/apply-csv-vat
// @desc    Apply VAT numbers extracted directly from Customer.csv
// @access  Super admin only
router.get('/apply-csv-vat', authorize('super_admin'), async (req, res) => {
  try {
    const csvData = [
      { name: "شركة مصنع معدات النقط الديناميكية", companyName: "DYNAMIC OIL TOOL COMPANY", vat: "310076186500003" },
      { name: "AL DAMMAM DEVELOPMENT CO", companyName: "شركة الدمام للتعمير", vat: "300398064900003" },
      { name: "SHRIMP RUSH", companyName: "موسسة نون المتخصصة لتقديم الوجبات", vat: "310250541900003" },
      { name: "NEFT ENERGIES", companyName: "شركة طاقات النفط المحدودة", vat: "301296278800003" },
      { name: "Ascent marines trading co.", companyName: "Ascent marines trading co.", vat: "311487853600003" },
      { name: "EVOO", companyName: "شركة ابداع الأغذية المحدودة", vat: "310456254300003" },
      { name: "ISAM KABBANI", companyName: "ISAM KABBANI", vat: "300803576810003" },
      { name: "TELL A TALE", companyName: "موسسة مجلسنا لتقديم الوجبات", vat: "310798648100003" },
      { name: "Bawan Al Memar Contracting co", companyName: "Bawan Al Memar Contracting co", vat: "310865473100003" },
      { name: "Farooh", companyName: "Farooh", vat: "0" },
      { name: "MODERN DISH COMPANY", companyName: "مطعم الطبق الحديث التقديم الوجبات", vat: "310160320800003" },
      { name: "Yamama Compound 3", companyName: "Yamama Compound 3", vat: "00000000000" },
      { name: "موسسة المنيعة للمقاولات العامة", companyName: "موسسة المنيعة للمقاولات العامة", vat: "312087664400003" },
      { name: "New Breeze Trading Est.", companyName: "New Breeze Trading Est.", vat: "312087664400003" },
      { name: "شركة فنون الغذاء للاستثمار", companyName: "شركة فنون الغذاء للاستثمار", vat: "310407849300003" },
      { name: "AJWAD", companyName: "AJWAD", vat: "300746214300003" },
      { name: "AJWAD ALUMINUM", companyName: "AJWAD ALUMINUM", vat: "300746214300003" },
      { name: "شركة منزل العجائب للمقاولات", companyName: "شركة منزل العجائب للمقاولات", vat: "312261416200003" },
      { name: "Anjik Resturant", companyName: "مطعم انجيك لتقديم الوجبات", vat: "300497909300003" },
      { name: "Sanbook Rest", companyName: "شركة مطعم السنبوك التجارية المحدودة", vat: "300458415900003" },
      { name: "Radix Desert Arabia Trading co", companyName: "Radix Desert Arabia Trading co", vat: "311328355100003" },
      { name: "Kingdom Tower", companyName: "Kingdom Tower", vat: "0" },
      { name: "Eid compound", companyName: "Eid compound", vat: "0" },
      { name: "Energy Project Support Company ENPRO", companyName: "Energy Project Support Company ENPRO", vat: "300553598700003" },
      { name: "PROSPERITY GLOBAL TRADING CO LTD", companyName: "PROSPERITY GLOBAL TRADING CO LTD", vat: "311783570400003" },
      { name: "SAUDI BULK TRANSPORT LTD", companyName: "الشركة السعودية النقل الساىب المحدودة", vat: "3004655772900003" },
      { name: "BANDARIYAH İNTERNATİONAL COMPANY", companyName: "BANDARIYAH İNTERNATİONAL COMPANY", vat: "310137602700003" },
      { name: "UNAN GLOBAL CO. LTD", companyName: "UNAN GLOBAL CO. LTD", vat: "310449697300003" },
      { name: "KRON COMPANY", companyName: "KRON COMPANY", vat: "311374164700003" },
      { name: "BCC COMPANY", companyName: "BCC COMPANY", vat: "000" },
      { name: "Mr. Tawfir Trading Establishment", companyName: "موسسة ساره عايض بن محمد اليامي التجارة", vat: "312470823500003" },
      { name: "Al Hussan Group", companyName: "شركة مجموعة الحصان للتعليم والتدريب", vat: "30121173800003" },
      { name: "SRACO ISD", companyName: "SRACO ISD", vat: "0" },
      { name: "Cash customer", companyName: "Cash customer", vat: "00" },
      { name: "Saudi Global Ports CO", companyName: "الشركة السعودية العالمية للمواني", vat: "300539765600003" },
      { name: "Basic Material Chemical Company", companyName: "Basic Material Chemical Company", vat: "312315731400003" },
      { name: "Danah Integrated Facilities Management", companyName: "Danah Integrated Facilities Management", vat: "0" },
      { name: "Mefreh bin M.bin Hussain Gazawei trading est.", companyName: "Mefreh bin M.bin Hussain Gazawei trading est.", vat: "302075265400003" },
      { name: "Ambition Gate Trading Est", companyName: "Ambition Gate Trading Est", vat: "311711094600003" },
      { name: "Gulf exchange trading company", companyName: "Gulf exchange trading company", vat: "311812999800003" },
      { name: "Rawabi Vallianz Offshore Services", companyName: "Rawabi Vallianz Offshore Services", vat: "300454908500003" },
      { name: "ARAB TRADE CONTRACTING EST", companyName: "ARAB TRADE CONTRACTING EST", vat: "300366676100003" },
      { name: "AFAAQ HOSPITALITY CATERING SERVICE CO", companyName: "شركة افاقا لضيافة لخدمات الاعاشة", vat: "310882729200003" },
      { name: "Danah Real Estate Company", companyName: "Danah Real Estate Company", vat: "300056271710003" },
      { name: "ESPAC", companyName: "ESPAC", vat: "300295965600003" },
      { name: "شركة بازي للتجارة المحدودة", companyName: "شركة بازي للتجارة المحدودة", vat: "300049926500003" },
      { name: "ABDUL LATEEF JAMEEL INDUSTRIAL EQUIPMENT CO LTD", companyName: "شركة عبداللطيف جميل للمعدات الصناعية المحدودة", vat: "310116574500003" },
      { name: "NAC", companyName: "شركة اصيل الموحدة المحدودة", vat: "310167120900003" },
      { name: "Mazen Al Zahrani", companyName: "Mazen Al Zahrani", vat: "000" },
      { name: "Jubail Chemical Industries Company", companyName: "Jubail Chemical Industries Company", vat: "300497149510003" },
      { name: "Abdullah A. Al-Barrak plastic product company", companyName: "Abdullah A. Al-Barrak plastic product company", vat: "0" },
      { name: "Newway Energy Company", companyName: "Newway Energy Company", vat: "0" },
      { name: "شركة لميس الدولية المحدود", companyName: "شركة لميس الدولية المحدود", vat: "302006056500003" },
      { name: "Fouz Chemical", companyName: "Fouz Chemical", vat: "0" },
      { name: "Rajas Gulf Trading Company", companyName: "Rajas Gulf Trading Company", vat: "312416156700003" },
      { name: "Yakeen Holding Company", companyName: "Yakeen Holding Company", vat: "310373049300003" },
      { name: "Al Rushaid House", companyName: "Al Rushaid House", vat: "0" },
      { name: "Ibrahim Manea Al-Yami trading and contracting", companyName: "Ibrahim Manea Al-Yami trading and contracting", vat: "312995718500003" },
      { name: "شركه برايت الطبي", companyName: "شركه برايت الطبي", vat: "310386188800003" },
      { name: "شركة دانة العقارية", companyName: "شركة دانة العقارية", vat: "0" },
      { name: "Sraco Industrial Services Division", companyName: "Sraco Industrial Services Division", vat: "300498103210003" },
      { name: "Prosperity global trading", companyName: "Prosperity global trading", vat: "311783570400003" },
      { name: "Naf Chem Trading EST.", companyName: "مؤسسة ناف كيم للتجارة", vat: "300779382600003" },
      { name: "M.A. AL Mutlaq Sons Co.", companyName: "شركة أبناء محمد علي المطلق للتجارة والمقاولات", vat: "30039389300003" },
      { name: "Joudco Trading and Contracting EST", companyName: "Joudco Trading and Contracting EST", vat: "312995718500003" },
      { name: "Safwat Sarah Industrial factory CO.", companyName: "Safwat Sarah Industrial factory CO.", vat: "312836129300003" },
      { name: "Shorewaves Trading Est", companyName: "Shorewaves Trading Est", vat: "300370373700003" },
      { name: "Explore Arabian Trading Establishment", companyName: "Explore Arabian Trading Establishment", vat: "311468931800003" },
      { name: "Innovation progress for chemicals", companyName: "Innovation progress for chemicals", vat: "300975573800003" },
      { name: "Globe Wave Trading Company", companyName: "Globe Wave Trading Company", vat: "311508475500003" },
      { name: "Tetra Phos Chemicals Co.", companyName: "Tetra Phos Chemicals Co.", vat: "312998464700003" },
      { name: "La Vie Kingdom Trading EST.", companyName: "La Vie Kingdom Trading EST.", vat: "300580966400003" },
      { name: "Premium Atlas Trading and Company", companyName: "Premium Atlas Trading and Company", vat: "300529646700003" },
      { name: "Premium Atlas Trading and Contracting Co.", companyName: "Premium Atlas Trading and Contracting Co.", vat: "300529646700003" },
      { name: "Gulf Metal Industrial Company", companyName: "Gulf Metal Industrial Company", vat: "312408379900003" },
      { name: "Kim Middle East Chemical Co.", companyName: "Kim Middle East Chemical Co.", vat: "310445687900003" },
      { name: "Malhamat hussain issa Al hamran for Meat", companyName: "ملحمة حسين عيسي الحمران للحوم", vat: "300508446700003" },
      { name: "Globe Wave Arabia Company", companyName: "Globe Wave Arabia Company", vat: "314139637700003" },
      { name: "Abaq-alfikara", companyName: "Abaq-alfikara", vat: "313078283500003" },
      { name: "Kanoo Manuchar Limited Company", companyName: "Kanoo Manuchar Limited Company", vat: "311917116200003" },
      { name: "شركة سعيد علي غدران واولاده المحدودة", companyName: "شركة سعيد علي غدران واولاده المحدودة", vat: "300585759100003" },
      { name: "ABNA ALI AL-TAROUTI CO", companyName: "ﴍﻛﺔ اﺑﻨﺎء ﻋﲇ اﻟﺘﺎروﺗﻲ", vat: "301082192300003" },
      { name: "Abraak International Co.", companyName: "Abraak International Co.", vat: "311742197700003" },
      { name: "King Faisal Foundation", companyName: "King Faisal Foundation", vat: "0000000000" },
      { name: "Kalada Chemical Solutions Trading Est.", companyName: "شركة محاليل كلدة للتجارة", vat: "310588493100003" },
      { name: "Al Fanar Company LTD", companyName: "Al Fanar Company LTD", vat: "300050206400003" },
      { name: "Radix Middle East Factory for Industry", companyName: "مصنع راديكس الشرق الاوسط للصناعة", vat: "311479084700003" },
      { name: "Al Rushaid Private Properties", companyName: "Al Rushaid Private Properties", vat: "0" },
      { name: "Anaq Trading Est.", companyName: "Anaq Trading Est.", vat: "300396771500003" },
      { name: "شركة المبادى الفنية للصناعات المعدنية", companyName: "TEPCO", vat: "310704985600003" },
      { name: "SBNT Company", companyName: "SBNT Company", vat: "314104014200003" },
      { name: "Middle East Specialized Cables Company (MESC)", companyName: "شـركـة الشـرق الأوســط للكـابـلات المتخصصه مسک", vat: "300056324300003" },
      { name: "SAFCO INDUSTRIAL CO.", companyName: "شركة صافكو الصناعية", vat: "0" },
      { name: "Paints, Solvents and Industrial Putty Company Limited", companyName: "شركة الدهانات والمذيبات والمعاجين الصناعية المحدودة", vat: "300056006200003" },
      { name: "Gulf Metals Industry Company", companyName: "شركة المعادن الخليجي للصناعة", vat: "312408379900003" },
      { name: "AFAAQ ALDHYAFAH FOR CATERING SERVICES CO", companyName: "شركة افاق الضيافة لخدمات", vat: "310882729200003" },
      { name: "Advanced Chemicals Industrial Company", companyName: "شركة الكيمياء المتقدمة للصناعة", vat: "310116329800003" },
      { name: "Fulla Trading Company", companyName: "شركة فله للتجارة", vat: "312339846600003" },
      { name: "JOES BAKERY", companyName: "مطعم زوق الجوز لتقديم الوجبات", vat: "310962018200003" },
      { name: "United Commercial Co.", companyName: "شركة جدول العالم المحدودة", vat: "311591790200003" }
    ];

    let fixedCount = 0;
    const bulkUpdates = [];

    for (const row of csvData) {
      // Find customer by name or companyName
      const customer = await Customer.findOne({
        $or: [
          { name: row.companyName },
          { name: row.name }
        ]
      });

      if (customer) {
        if (customer.vatNumber !== row.vat) {
          bulkUpdates.push({
            updateOne: {
              filter: { _id: customer._id },
              update: { $set: { vatNumber: row.vat } }
            }
          });
          fixedCount++;
        }
      }
    }

    if (bulkUpdates.length > 0) {
      await Customer.bulkWrite(bulkUpdates);
    }

    res.json({
      message: 'VAT recovery from CSV was absolutely successful!',
      customersUpdated: fixedCount,
      success: true
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/customers/recover-vat
// @desc    Recover VAT numbers dropped during migration and deduplicate customers
// @access  Super admin only
router.get('/recover-vat', authorize('super_admin'), async (req, res) => {
  // Return immediately so Cloudflare doesn't timeout
  res.json({
    message: 'Cleanup & VAT Recovery has started in the background! Please wait 60 seconds and then refresh your Customers panel.',
    status: 'processing'
  });

  try {
    const db = mongoose.connection.db;
    const customersCollection = db.collection('customers');
    
    // 1. Deduplicate customers
    const allCustomers = await Customer.find({});
    const nameGroups = {};
    
    for (const c of allCustomers) {
      if (!c.name || !c.tenantId) continue;
      const key = `${c.tenantId}_${c.name.trim().toLowerCase()}`;
      if (!nameGroups[key]) nameGroups[key] = [];
      nameGroups[key].push(c);
    }
    
    const invoiceUpdates = [];
    const customerDeletes = [];

    for (const key in nameGroups) {
      if (nameGroups[key].length > 1) {
        const group = nameGroups[key];
        group.sort((a, b) => {
           const scoreA = (a.vatNumber ? 10 : 0) + (a.phone ? 5 : 0) + (a.totalInvoices || 0);
           const scoreB = (b.vatNumber ? 10 : 0) + (b.phone ? 5 : 0) + (b.totalInvoices || 0);
           return scoreB - scoreA;
        });
        
        const kept = group[0];
        const toDelete = group.slice(1);
        
        for (const dup of toDelete) {
          invoiceUpdates.push({
            updateMany: {
              filter: { customerId: dup._id },
              update: { $set: { customerId: kept._id } }
            }
          });
          customerDeletes.push({
            deleteOne: {
              filter: { _id: dup._id }
            }
          });
        }
      }
    }

    if (invoiceUpdates.length > 0) {
      await mongoose.model('Invoice').bulkWrite(invoiceUpdates);
    }
    if (customerDeletes.length > 0) {
      await Customer.bulkWrite(customerDeletes);
    }

    // 2. Recover VAT from hidden 'taxNumber'
    const customersWithTaxNum = await customersCollection.find({
      taxNumber: { $exists: true, $ne: '' },
      $or: [
        { vatNumber: { $exists: false } },
        { vatNumber: '' },
        { vatNumber: null }
      ]
    }).toArray();

    if (customersWithTaxNum.length > 0) {
      const taxUpdates = customersWithTaxNum.map(c => ({
        updateOne: {
          filter: { _id: c._id },
          update: { $set: { vatNumber: c.taxNumber } }
        }
      }));
      await customersCollection.bulkWrite(taxUpdates);
    }

    // 3. Fallback to invoice data
    const customersToFix = await Customer.find({ vatNumber: { $in: [null, '', undefined] } });
    const invoiceFallbackUpdates = [];

    for (const customer of customersToFix) {
      const invoice = await mongoose.model('Invoice').findOne({
        customerId: customer._id,
        'buyer.vatNumber': { $exists: true, $ne: '' }
      }).select('buyer.vatNumber');

      if (invoice && invoice.buyer && invoice.buyer.vatNumber) {
        invoiceFallbackUpdates.push({
          updateOne: {
            filter: { _id: customer._id },
            update: { $set: { vatNumber: invoice.buyer.vatNumber } }
          }
        });
      }
    }

    if (invoiceFallbackUpdates.length > 0) {
      await Customer.bulkWrite(invoiceFallbackUpdates);
    }

    console.log('VAT Recovery Background Task Completed Successfully');
  } catch (error) {
    console.error('VAT Recovery Error:', error);
  }
});

// @route   GET /api/customers
// @desc    Get all customers
router.get('/', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const { search, type, isActive, page = 1, limit = 20 } = req.query;
    
    const query = asCustomerQuery({ ...req.tenantFilter });
    
    if (search) {
      const cleanSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { customerCode: { $regex: cleanSearch, $options: 'i' } },
        { name: { $regex: cleanSearch, $options: 'i' } },
        { nameAr: { $regex: cleanSearch, $options: 'i' } },
        { nameEn: { $regex: cleanSearch, $options: 'i' } },
        { email: { $regex: cleanSearch, $options: 'i' } },
        { phone: { $regex: cleanSearch, $options: 'i' } },
        { mobile: { $regex: cleanSearch, $options: 'i' } },
        { vatNumber: { $regex: cleanSearch, $options: 'i' } }
      ];
    }
    
    if (type) {
      query.type = type;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [customersData, total] = await Promise.all([
      Customer.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Customer.countDocuments(query)
    ]);
    
    // Compute khayyat stats if needed
    const customerIds = customersData.map(c => c._id);
    const KhayyatStitching = (await import('../models/khayyat/KhayyatStitching.js')).default;
    const stitchingStats = await KhayyatStitching.aggregate([
      { $match: { tenantId: req.user.tenantId, customerId: { $in: customerIds } } },
      { $group: {
          _id: '$customerId',
          totalThawb: { $sum: { $ifNull: ['$quantity', 0] } },
          totalPrice: { $sum: { $ifNull: ['$price', 0] } },
          totalPaid: { $sum: { $ifNull: ['$paidAmount', 0] } }
        }
      }
    ]);
    
    const statsMap = {};
    stitchingStats.forEach(s => {
      statsMap[s._id.toString()] = s;
    });
    
    const customers = customersData.map(c => {
      const base = toCustomerDto(c);
      const s = statsMap[c._id.toString()];
      if (s) {
        return {
          ...base,
          totalThawb: s.totalThawb,
          khayyatPaidAmount: s.totalPaid,
          khayyatPendingAmount: Math.max(0, s.totalPrice - s.totalPaid)
        };
      }
      return base;
    });
    
    res.json({
      customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/customers/search
// @desc    Quick search for autocomplete
router.get('/search', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || String(q).trim().length < 2) {
      return res.json([]);
    }
    
    const cleanQ = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const customers = await Customer.find(asCustomerQuery({
      ...req.tenantFilter,
      isActive: true,
      $or: [
        { customerCode: { $regex: cleanQ, $options: 'i' } },
        { name: { $regex: cleanQ, $options: 'i' } },
        { nameAr: { $regex: cleanQ, $options: 'i' } },
        { nameEn: { $regex: cleanQ, $options: 'i' } },
        { vatNumber: { $regex: cleanQ, $options: 'i' } },
        { phone: { $regex: cleanQ, $options: 'i' } },
        { mobile: { $regex: cleanQ, $options: 'i' } }
      ]
    }))
      .select('customerCode name nameAr nameEn email phone vatNumber taxNumber type address isCustomer isVendor')
      .limit(10)
      .lean();
    
    res.json(customers.map(toCustomerDto));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/customers/stats
// @desc    Get customer statistics
router.get('/stats', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const payload = await cachedTenantStats(req, 'customers', async () => {
    const match = asCustomerQuery({});
    if (req.user?.role !== 'super_admin' && req.user?.tenantId) {
      match.tenantId = new mongoose.Types.ObjectId(String(req.user.tenantId));
    }

    const stats = await Customer.aggregate([
      { $match: match },
      {
        $facet: {
          total: [{ $count: 'count' }],
          byType: [{ $group: { _id: '$type', count: { $sum: 1 } } }],
          active: [{ $match: { isActive: { $ne: false } } }, { $count: 'count' }],
          withVat: [{ $match: { vatNumber: { $exists: true, $nin: ['', null] } } }, { $count: 'count' }],
          revenue: [{ $group: { _id: null, totalRevenue: { $sum: '$totalRevenue' }, totalInvoices: { $sum: '$totalInvoices' } } }],
          topByRevenue: [
            { $sort: { totalRevenue: -1 } },
            { $limit: 5 },
            { $project: { name: 1, nameAr: 1, totalRevenue: 1, totalInvoices: 1 } }
          ]
        }
      }
    ]);
    
    return {
      total: stats[0]?.total[0]?.count || 0,
      active: stats[0]?.active[0]?.count || 0,
      withVat: stats[0]?.withVat[0]?.count || 0,
      totalRevenue: stats[0]?.revenue[0]?.totalRevenue || 0,
      totalInvoices: stats[0]?.revenue[0]?.totalInvoices || 0,
      byType: stats[0]?.byType || [],
      topByRevenue: stats[0]?.topByRevenue || []
    };
    });

    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/customers/:id
// @desc    Get single customer
router.get('/:id', checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const customer = await Customer.findOne(asCustomerQuery({
      _id: req.params.id,
      ...req.tenantFilter
    }));
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json(toCustomerDto(customer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// @route   POST /api/customers
// @desc    Create new customer
router.post('/', checkTrialLimits('customers'), checkPermission('invoicing', 'create'), async (req, res) => {
  try {
    if (!req.user?.tenantId) {
      return res.status(400).json({ error: 'No tenant associated with user' });
    }

    const customerData = fromCustomerBody({
      ...req.body,
      tenantId: req.user.tenantId,
      isCustomer: true,
    });
    
    // Check for duplicate VAT number if provided
    if (customerData.vatNumber) {
      const existing = await Customer.findOne(asCustomerQuery({
        tenantId: req.user.tenantId,
        vatNumber: customerData.vatNumber
      }));
      
      if (existing) {
        return res.status(400).json({ error: 'Customer with this VAT number already exists' });
      }
    }
    
    if (!customerData.customerCode) {
      customerData.customerCode = await nextCustomerCode(req.user.tenantId);
    }

    if (customerData.isVendor && !customerData.supplierCode) {
      const { nextSupplierCode } = await import('../services/partnerService.js');
      customerData.supplierCode = await nextSupplierCode(req.user.tenantId);
    }

    const customer = new Customer(customerData);
    await customer.save();
    
    res.status(201).json(toCustomerDto(customer));
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ error: errors.join(', ') });
    }
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/customers/:id
// @desc    Update customer
router.put('/:id', checkPermission('invoicing', 'update'), async (req, res) => {
  try {
    const existingDoc = await Customer.findOne(asCustomerQuery({
      _id: req.params.id,
      ...req.tenantFilter,
    }));

    if (!existingDoc) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const tenantId = req.user?.role === 'super_admin' ? existingDoc.tenantId : req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'No tenant associated with user' });
    }

    const patch = fromCustomerBody(req.body);
    delete patch.tenantId;

    if (patch.vatNumber && patch.vatNumber !== existingDoc.vatNumber) {
      const existing = await Customer.findOne(asCustomerQuery({
        tenantId,
        vatNumber: patch.vatNumber,
        _id: { $ne: req.params.id },
      }));

      if (existing) {
        return res.status(400).json({ error: 'Customer with this VAT number already exists' });
      }
    }

    if (patch.isVendor && !existingDoc.supplierCode && !patch.supplierCode) {
      const { nextSupplierCode } = await import('../services/partnerService.js');
      patch.supplierCode = await nextSupplierCode(tenantId);
    }

    Object.assign(existingDoc, patch);
    existingDoc.isCustomer = true;
    await existingDoc.save();

    res.json(toCustomerDto(existingDoc));
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ error: errors.join(', ') });
    }
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/customers/:id
// @desc    Delete customer (soft delete)
router.delete('/:id', checkPermission('invoicing', 'delete'), async (req, res) => {
  try {
    const customer = await Customer.findOne(asCustomerQuery({
      _id: req.params.id,
      ...req.tenantFilter
    }));
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Soft delete
    customer.isActive = false;
    await customer.save();
    
    res.json({ message: 'Customer deactivated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
