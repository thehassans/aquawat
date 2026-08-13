import express from 'express';
import RentalContract from '../models/RentalContract.js';
import RentalCar from '../models/RentalCar.js';
import RentalCustomer from '../models/RentalCustomer.js';
import RentalInvoice from '../models/RentalInvoice.js';
import { protect, tenantFilter, requireBusinessType, requireTenantFilter } from '../middleware/auth.js';
import { generateContractZatcaQr } from '../lib/zatcaQr.js';
import { isZatcaCurrency } from '../utils/zatcaCurrency.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('car_rental'));

// ─── Fuel level numeric values for penalty calculation ──────────────────────

const FUEL_VALUES = {
  empty: 0,
  quarter: 0.25,
  half: 0.5,
  three_quarters: 0.75,
  full: 1.0,
};

/** Flat per-level penalty tiers. Adjust to match tenant pricing policies. */
const FUEL_PENALTY_PER_LEVEL = 50; // SAR per level below outbound

function calcFuelPenalty(fuelLevelOut, fuelLevelIn, dailyRate) {
  const levelDiff = (FUEL_VALUES[fuelLevelOut] ?? 1) - (FUEL_VALUES[fuelLevelIn] ?? 1);
  if (levelDiff <= 0) return 0;
  // Convert continuous difference to level steps (each step = 0.25)
  const steps = Math.round(levelDiff / 0.25);
  return steps * FUEL_PENALTY_PER_LEVEL;
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [statusAgg, revenueToday, revenueMonth, overdueCount] = await Promise.all([
      RentalContract.aggregate([
        { $match: { tenantId: req.tenantFilter.tenantId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      RentalContract.aggregate([
        { $match: { tenantId: req.tenantFilter.tenantId, status: 'CLOSED', actualReturnDateTime: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]),
      RentalContract.aggregate([
        { $match: { tenantId: req.tenantFilter.tenantId, status: 'CLOSED', actualReturnDateTime: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]),
      RentalContract.countDocuments({
        tenantId: req.tenantFilter.tenantId,
        status: 'OPEN',
        expectedReturnDateTime: { $lt: now }
      })
    ]);

    const statusMap = {};
    statusAgg.forEach(s => { statusMap[s._id] = s.count; });

    res.json({
      open: statusMap['OPEN'] || 0,
      closed: statusMap['CLOSED'] || 0,
      cancelled: statusMap['CANCELLED'] || 0,
      overdue: overdueCount,
      revenueToday: revenueToday[0]?.total || 0,
      revenueMonth: revenueMonth[0]?.total || 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── List ──────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 25, status, search } = req.query;
    const query = { tenantId: req.tenantFilter.tenantId };

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { contractNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const [contracts, total] = await Promise.all([
      RentalContract.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('vehicleId', 'make model plateNumber plateEnglishLetters year color status')
        .populate('customerId', 'fullName fullNameAr phoneNumber iqamaId isBlacklisted'),
      RentalContract.countDocuments(query)
    ]);

    res.json({ contracts, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Single ────────────────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const contract = await RentalContract.findOne({ _id: req.params.id, tenantId: req.tenantFilter.tenantId })
      .populate('vehicleId')
      .populate('customerId')
      .populate('createdBy', 'name email')
      .populate('closedBy', 'name email');
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    // Flatten car/customer aliases for frontend compatibility
    const doc = contract.toObject();
    doc.car = doc.vehicleId;
    doc.customer = doc.customerId;
    doc.startDateTime = doc.rentPeriod?.start;
    doc.expectedReturnDateTime = doc.rentPeriod?.end;
    doc.securityDeposit = doc.depositAmount;
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── ZATCA Invoice ─────────────────────────────────────────────────────────────

router.get('/:id/invoice', async (req, res) => {
  try {
    const contract = await RentalContract.findOne({ _id: req.params.id, tenantId: req.tenantFilter.tenantId })
      .populate('car', 'make model plateNumber year')
      .populate('customer', 'fullName mobile idNumber');
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    if (contract.status !== 'CLOSED') {
      return res.status(400).json({ error: 'Invoice is only available for closed contracts' });
    }
    res.json({
      contract,
      zatcaQrCode: contract.zatcaQrCode,
      invoiceLines: [
        { description: `Car Rental — ${contract.rentedDays} day(s)`, amount: contract.baseCharge },
        contract.extraMileageCharge > 0 && { description: `Extra Mileage (${contract.excessKm} km)`, amount: contract.extraMileageCharge },
        contract.latePenalty > 0 && { description: 'Late Return Penalty', amount: contract.latePenalty },
        contract.fuelPenalty > 0 && { description: 'Fuel Level Penalty', amount: contract.fuelPenalty },
        contract.damageCharge > 0 && { description: 'Damage Charges', amount: contract.damageCharge },
        contract.discountAmount > 0 && { description: `Discount (${contract.discountReason || ''})`, amount: -contract.discountAmount },
      ].filter(Boolean),
      vatRate: 0.15,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CHECK-OUT CONTROLLER
// POST /api/rental/contracts/checkout
// ─────────────────────────────────────────────────────────────────────────────
router.post('/checkout', async (req, res) => {
  try {
    const {
      carId,
      customerId,
      startDateTime,
      expectedReturnDateTime,
      dailyRate,
      allowedKmPerDay,
      perKmOverageRate,
      hourlyLateRate,
      securityDeposit,
      odometerOut,
      fuelLevelOut,
      damageNotes,
      photos,
    } = req.body;

    // ── 1. Validate car availability ──────────────────────────────────────────
    const car = await RentalCar.findOne({ _id: carId, tenantId: req.user.tenantId });
    if (!car) return res.status(404).json({ error: 'Car not found' });
    if (car.status !== 'AVAILABLE') {
      return res.status(400).json({
        error: `Car is not available. Current status: ${car.status}`,
        status: car.status
      });
    }

    // ── 2. Validate customer (blacklist check) ────────────────────────────────
    const customer = await RentalCustomer.findOne({ _id: customerId, tenantId: req.user.tenantId });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    if (customer.isBlacklisted) {
      return res.status(400).json({
        error: 'Customer is blacklisted and cannot rent a vehicle',
        reason: customer.blacklistReason
      });
    }

    // ── 3. Validate license expiry ────────────────────────────────────────────
    if (customer.licenseExpiry && new Date(customer.licenseExpiry) < new Date()) {
      return res.status(400).json({ error: 'Customer driving license has expired' });
    }

    // ── 4. Build and save contract ────────────────────────────────────────────
    const contract = new RentalContract({
      tenantId: req.user.tenantId,
      vehicleId: carId,
      customerId: customerId,
      status: 'OPEN',
      rentPeriod: {
        start: new Date(startDateTime),
        end: new Date(expectedReturnDateTime),
      },
      dailyRate: Number(dailyRate) || car.dailyRateDefault,
      allowedKmPerDay: Number(allowedKmPerDay) ?? car.allowedKmPerDayDefault,
      perKmOverageRate: Number(perKmOverageRate) ?? car.perKmOverageRateDefault,
      hourlyLateRate: Number(hourlyLateRate) ?? car.hourlyLateRateDefault,
      depositAmount: Number(securityDeposit) ?? car.securityDepositDefault,
      outboundCondition: {
        odometer: Number(odometerOut) || car.currentOdometer,
        fuelLevel: fuelLevelOut || 'full',
        damageNotes: damageNotes || '',
        damagePins: req.body.damagePins || [],
        photos: photos || [],
        recordedBy: req.user._id,
      },
      createdBy: req.user._id,
    });

    await contract.save();

    // ── 5. Update car status ───────────────────────────────────────────────────
    car.status = 'RENTED';
    await car.save();

    // ── 6. Update customer stats ───────────────────────────────────────────────
    customer.totalRentals = (customer.totalRentals || 0) + 1;
    customer.lastRentalDate = new Date();
    await customer.save();

    await contract.populate([
      { path: 'vehicleId', select: 'make model plateNumber plateEnglishLetters year color' },
      { path: 'customerId', select: 'fullName phoneNumber iqamaId' }
    ]);

    res.status(201).json({ message: 'Check-out successful', contract });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CHECK-IN CONTROLLER
// POST /api/rental/contracts/:id/checkin
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/checkin', async (req, res) => {
  try {
    const {
      odometerIn,
      fuelLevelIn,
      actualReturnDateTime,
      damageNotes,
      photos,
      damageCharge,
      discountAmount,
      discountReason,
    } = req.body;

    // ── 1. Load and validate contract ─────────────────────────────────────────
    const contract = await RentalContract.findOne({
      _id: req.params.id,
      tenantId: req.tenantFilter.tenantId
    }).populate('car').populate('customer');

    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    if (contract.status !== 'OPEN') {
      return res.status(400).json({ error: `Contract is already ${contract.status}` });
    }

    const actualReturn = actualReturnDateTime ? new Date(actualReturnDateTime) : new Date();
    const odomIn = Number(odometerIn);
    const fuelIn = fuelLevelIn || 'full';

    // ── 2. Compute rented days ────────────────────────────────────────────────
    // Always ceil to nearest day (standard car rental practice)
    const msPerDay = 1000 * 60 * 60 * 24;
    const msRented = actualReturn - contract.startDateTime;
    const rentedDays = Math.max(1, Math.ceil(msRented / msPerDay));

    // ── 3. Base charge ────────────────────────────────────────────────────────
    const baseCharge = contract.dailyRate * rentedDays;

    // ── 4. Mileage penalty ────────────────────────────────────────────────────
    const odomOut = contract.outboundCondition?.odometer || 0;
    const actualKm = Math.max(0, odomIn - odomOut);
    const allowedKmTotal = contract.allowedKmPerDay * rentedDays;
    const excessKm = Math.max(0, actualKm - allowedKmTotal);
    const extraMileageCharge = excessKm * (contract.perKmOverageRate || 0);

    // ── 5. Late penalty ───────────────────────────────────────────────────────
    let latePenalty = 0;
    if (actualReturn > contract.expectedReturnDateTime && contract.hourlyLateRate > 0) {
      const msLate = actualReturn - contract.expectedReturnDateTime;
      const hoursLate = Math.ceil(msLate / (1000 * 60 * 60)); // ceil to next hour
      latePenalty = hoursLate * contract.hourlyLateRate;
    }

    // ── 6. Fuel penalty ───────────────────────────────────────────────────────
    const fuelPenalty = calcFuelPenalty(
      contract.outboundCondition?.fuelLevel || 'full',
      fuelIn,
      contract.dailyRate
    );

    // ── 7. Additional charges / discounts ─────────────────────────────────────
    const dmgCharge = Number(damageCharge) || 0;
    const discount = Number(discountAmount) || 0;

    // ── 8. Totals with 15% ZATCA VAT ──────────────────────────────────────────
    const subtotal = baseCharge + extraMileageCharge + latePenalty + fuelPenalty + dmgCharge - discount;
    const totalVat = Math.round(subtotal * 0.15 * 100) / 100;   // 15% — ZATCA compliant
    const grandTotal = Math.round((subtotal + totalVat) * 100) / 100;
    const finalBalance = Math.round((grandTotal - contract.securityDeposit) * 100) / 100;
    // Negative finalBalance = refund owed to customer

    // ── 9. Update contract ────────────────────────────────────────────────────
    contract.status = 'CLOSED';
    contract.actualReturnDateTime = actualReturn;
    contract.closedBy = req.user._id;

    contract.inboundCondition = {
      odometer: odomIn,
      fuelLevel: fuelIn,
      damageNotes: damageNotes || '',
      photos: photos || [],
      recordedBy: req.user._id,
    };

    // Computed fields
    contract.rentedDays = rentedDays;
    contract.odometerDelta = actualKm;
    contract.allowedKmTotal = allowedKmTotal;
    contract.excessKm = excessKm;
    contract.baseCharge = baseCharge;
    contract.extraMileageCharge = extraMileageCharge;
    contract.latePenalty = latePenalty;
    contract.fuelPenalty = fuelPenalty;
    contract.damageCharge = dmgCharge;
    contract.discountAmount = discount;
    contract.discountReason = discountReason || '';
    contract.subtotal = subtotal;
    contract.totalVat = totalVat;
    contract.grandTotal = grandTotal;
    contract.finalBalance = finalBalance;

    // ── 10. Generate ZATCA QR (SAR-denominated tenants only) ──────────────────
    if (isZatcaCurrency(req.tenant)) {
      try {
        contract.zatcaQrCode = generateContractZatcaQr(contract, req.tenant);
      } catch (_) {
        // Non-fatal — invoice can still be issued without QR
      }
    }

    await contract.save();

    // ── 11. Update car status to MAINTENANCE ──────────────────────────────────
    // Car should be inspected before going back to AVAILABLE
    const car = contract.car;
    car.status = 'MAINTENANCE';
    car.currentOdometer = odomIn;
    await car.save();

    // ── 12. Update customer revenue stats ─────────────────────────────────────
    await RentalCustomer.findByIdAndUpdate(contract.customer._id || contract.customer, {
      $inc: { totalRevenue: grandTotal }
    });

    // ── 13. Create RentalInvoice record ──────────────────────────────────────
    let invoiceId = null;
    let invoiceNumber = null;
    try {
      const invDate = today => {
        const d = today || new Date();
        return `RINv-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
      };
      const now = new Date();
      const invPrefix = invDate(now);
      const lastInv = await RentalInvoice.findOne(
        { tenantId: req.user.tenantId, invoiceNumber: { $regex: `^${invPrefix}-` } },
        { invoiceNumber: 1 }
      ).sort({ createdAt: -1 });
      let invSeq = 1;
      if (lastInv?.invoiceNumber) {
        const parts = lastInv.invoiceNumber.split('-');
        const n = Number(parts[parts.length - 1]);
        if (Number.isFinite(n)) invSeq = n + 1;
      }
      invoiceNumber = `${invPrefix}-${String(invSeq).padStart(3, '0')}`;
      const inv = await RentalInvoice.create({
        tenantId: req.user.tenantId,
        contractId: contract._id,
        invoiceNumber,
        zatcaQrCodeString: contract.zatcaQrCode || '',
        subTotal: subtotal,
        vatAmount: totalVat,
        grandTotal,
        createdBy: req.user._id,
      });
      invoiceId = inv._id;
    } catch (_) {
      // Non-fatal — contract is still closed
    }

    res.json({
      message: 'Check-in successful',
      contract,
      invoiceId,
      invoiceNumber,
      settlement: {
        rentedDays,
        baseCharge,
        extraMileageCharge,
        latePenalty,
        fuelPenalty,
        damageCharge: dmgCharge,
        discountAmount: discount,
        subtotal,
        totalVat,
        grandTotal,
        securityDeposit: contract.securityDeposit,
        finalBalance,
        isRefund: finalBalance < 0,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL CONTRACT
// POST /api/rental/contracts/:id/cancel
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/cancel', async (req, res) => {
  try {
    const contract = await RentalContract.findOne({
      _id: req.params.id,
      tenantId: req.tenantFilter.tenantId
    }).populate('car');

    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    if (contract.status !== 'OPEN') {
      return res.status(400).json({ error: `Cannot cancel a ${contract.status} contract` });
    }

    contract.status = 'CANCELLED';
    contract.cancelledReason = req.body.reason || '';
    await contract.save();

    // Return car to AVAILABLE
    if (contract.car) {
      contract.car.status = 'AVAILABLE';
      await contract.car.save();
    }

    res.json({ message: 'Contract cancelled', contract });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
