import express from 'express';
import Branch from '../models/Branch.js';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import RestaurantMenuItem from '../models/RestaurantMenuItem.js';
import RestaurantTable from '../models/RestaurantTable.js';
import { protect, tenantFilter, checkPermission, requireBusinessType, authorize, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);
router.use(requireBusinessType('restaurant'));

// Check branch add-on is enabled
const checkBranchAddon = (req, res, next) => {
  if (req.user.role === 'super_admin') return next();
  if (!req.tenant?.subscription?.hasBranchAddon) {
    return res.status(403).json({ error: 'Branch add-on is not enabled for this tenant' });
  }
  next();
};

// List branches
router.get('/', checkPermission('settings', 'read'), async (req, res) => {
  try {
    const branches = await Branch.find({ ...req.tenantFilter, isActive: true }).sort({ name: 1 });
    res.json(branches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single branch
router.get('/:id', checkPermission('settings', 'read'), async (req, res) => {
  try {
    const branch = await Branch.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    res.json(branch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create branch
router.post('/', checkPermission('settings', 'create'), checkBranchAddon, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const tenant = await Tenant.findById(tenantId).select('subscription');
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const maxBranches = Number(tenant.subscription?.maxBranches || 0);
    if (maxBranches > 0) {
      const count = await Branch.countDocuments({ tenantId, isActive: true });
      if (count >= maxBranches) {
        return res.status(403).json({ error: `Branch limit reached (${maxBranches}). Contact super admin to increase.` });
      }
    }

    const { name, nameAr, phone, email, address, managerName } = req.body;
    if (!name) return res.status(400).json({ error: 'Branch name is required' });

    const existing = await Branch.findOne({ tenantId, name: { $regex: `^${name}$`, $options: 'i' } });
    if (existing) return res.status(400).json({ error: 'Branch with this name already exists' });

    const branch = await Branch.create({
      tenantId,
      name,
      nameAr,
      phone,
      email,
      address,
      managerName,
      createdBy: req.user._id,
    });

    res.status(201).json(branch);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Branch with this name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update branch
router.put('/:id', checkPermission('settings', 'update'), checkBranchAddon, async (req, res) => {
  try {
    const { name, nameAr, phone, email, address, managerName, isActive } = req.body;
    const branch = await Branch.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { name, nameAr, phone, email, address, managerName, isActive },
      { new: true, runValidators: true }
    );
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    res.json(branch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete (deactivate) branch
router.delete('/:id', checkPermission('settings', 'delete'), checkBranchAddon, async (req, res) => {
  try {
    const branch = await Branch.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false },
      { new: true }
    );
    if (!branch) return res.status(404).json({ error: 'Branch not found' });

    // Deactivate all users for this branch
    await User.updateMany({ branchId: branch._id }, { isActive: false });

    res.json({ message: 'Branch deactivated', branch });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List branch users
router.get('/:id/users', checkPermission('settings', 'read'), checkBranchAddon, async (req, res) => {
  try {
    const users = await User.find({ branchId: req.params.id, tenantId: req.user.tenantId })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create branch user (username + password for branch login)
router.post('/:id/users', checkPermission('settings', 'create'), checkBranchAddon, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const branchId = req.params.id;

    const branch = await Branch.findOne({ _id: branchId, tenantId, isActive: true });
    if (!branch) return res.status(404).json({ error: 'Branch not found or inactive' });

    const { email, password, firstName, lastName, phone, role } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (!firstName) return res.status(400).json({ error: 'First name is required' });
    if (!lastName) return res.status(400).json({ error: 'Last name is required' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ tenantId, email: normalizedEmail });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const validRoles = ['manager', 'sales', 'kitchen_staff', 'viewer'];
    const userRole = validRoles.includes(role) ? role : 'manager';

    const user = await User.create({
      tenantId,
      branchId,
      email: normalizedEmail,
      password,
      firstName,
      lastName,
      phone,
      role: userRole,
      isActive: true,
      permissions: userRole === 'kitchen_staff'
        ? [{ module: 'restaurant', actions: ['read', 'update'] }]
        : [],
    });

    const saved = await User.findById(user._id).select('-password');
    res.status(201).json(saved);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Duplicate user email' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update branch user
router.put('/:id/users/:userId', checkPermission('settings', 'update'), checkBranchAddon, async (req, res) => {
  try {
    const { firstName, lastName, phone, role, isActive, password } = req.body;
    const user = await User.findOne({ _id: req.params.userId, branchId: req.params.id, tenantId: req.user.tenantId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (role) {
      const validRoles = ['manager', 'sales', 'kitchen_staff', 'viewer'];
      if (validRoles.includes(role)) user.role = role;
    }
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (password && password.length >= 6) user.password = password;

    await user.save();
    const saved = await User.findById(user._id).select('-password');
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete branch user (deactivate)
router.delete('/:id/users/:userId', checkPermission('settings', 'delete'), checkBranchAddon, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.userId, branchId: req.params.id, tenantId: req.user.tenantId },
      { isActive: false },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get branch menu assignment (all menu items with their branch availability for this branch)
router.get('/:id/menu-items', checkPermission('settings', 'read'), checkBranchAddon, async (req, res) => {
  try {
    const branch = await Branch.findOne({ _id: req.params.id, ...req.tenantFilter, isActive: true });
    if (!branch) return res.status(404).json({ error: 'Branch not found' });

    const items = await RestaurantMenuItem.find({ ...req.tenantFilter, isActive: true })
      .select('_id nameEn nameAr sku category sellingPrice branchIds')
      .sort({ category: 1, nameEn: 1 });

    res.json(items.map(it => ({
      ...it.toObject(),
      isAssigned: it.branchIds.length === 0 || it.branchIds.some(bid => bid.toString() === branch._id.toString())
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update branch menu assignment (assign/unassign many menu items to a branch)
router.put('/:id/menu-items', checkPermission('settings', 'update'), checkBranchAddon, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const branchId = req.params.id;
    const { assignedItemIds } = req.body; // array of item IDs that should be available for this branch

    const branch = await Branch.findOne({ _id: branchId, tenantId, isActive: true });
    if (!branch) return res.status(404).json({ error: 'Branch not found' });

    const allItems = await RestaurantMenuItem.find({ tenantId, isActive: true });
    const assignedIds = new Set((assignedItemIds || []).map(id => id.toString()));

    const updates = [];
    for (const item of allItems) {
      const itemBranches = (item.branchIds || []).map(bid => bid.toString());
      const isAssigned = itemBranches.length === 0 || itemBranches.includes(branchId);
      const shouldAssign = assignedIds.has(item._id.toString());

      if (isAssigned === shouldAssign) continue;

      let newBranchIds;
      if (shouldAssign) {
        // Add this branch to item's allowed list (excluding if already global)
        newBranchIds = itemBranches.length === 0 ? [] : [...new Set([...itemBranches, branchId])];
      } else {
        // Remove this branch from item's allowed list
        newBranchIds = itemBranches.filter(bid => bid !== branchId);
        // If all specific branches removed, keep it global (empty)
      }

      updates.push(RestaurantMenuItem.updateOne(
        { _id: item._id, tenantId },
        { $set: { branchIds: newBranchIds } }
      ));
    }

    await Promise.all(updates);

    res.json({ message: 'Branch menu updated', updated: updates.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
