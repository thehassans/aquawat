import fs from 'fs';
import path from 'path';
import LeadSetup from '../models/LeadSetup.js';

export const getLeadSetups = async (req, res) => {
  try {
    const resellerId = req.user.role === 'reseller' ? req.user._id : null;
    const tenantId = req.tenant ? req.tenant._id : null;
    
    // We want to fetch the "best" setup for each business type
    // Since there could be multiple setups per type (SuperAdmin, Reseller, Tenant),
    // we'll just fetch all that apply to the current context and resolve them on the frontend,
    // or resolve them here.
    const query = {
      $or: [
        { tenantId: null, resellerId: null }
      ]
    };

    if (resellerId) {
      query.$or.push({ resellerId, tenantId: null });
    }
    
    if (tenantId) {
      query.$or.push({ tenantId });
      if (req.tenant.resellerId) {
         query.$or.push({ resellerId: req.tenant.resellerId, tenantId: null });
      }
    }

    const setups = await LeadSetup.find(query);
    
    // Resolve hierarchy
    const resolvedSetups = {};
    for (const setup of setups) {
      const type = setup.businessType;
      // Score: Tenant = 3, Reseller = 2, SuperAdmin = 1
      let score = 1;
      if (setup.tenantId) score = 3;
      else if (setup.resellerId) score = 2;

      if (!resolvedSetups[type] || resolvedSetups[type].score < score) {
         resolvedSetups[type] = { ...setup.toObject(), score };
      }
    }
    
    res.json(Object.values(resolvedSetups).map(s => {
       const { score, ...rest } = s;
       return rest;
    }));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const getLeadSetupByType = async (req, res) => {
  try {
    const { type } = req.params;
    const resellerId = req.user.role === 'reseller' ? req.user._id : (req.tenant ? req.tenant.resellerId : null);
    const tenantId = req.tenant ? req.tenant._id : null;
    
    // Try Tenant
    if (tenantId) {
       const setup = await LeadSetup.findOne({ businessType: type, tenantId });
       if (setup) return res.json(setup);
    }
    
    // Try Reseller
    if (resellerId) {
       const setup = await LeadSetup.findOne({ businessType: type, resellerId, tenantId: null });
       if (setup) return res.json(setup);
    }
    
    // Fallback Super Admin
    const setup = await LeadSetup.findOne({ businessType: type, resellerId: null, tenantId: null });
    
    if (!setup) {
      return res.status(404).json({ error: 'Setup not found' });
    }
    res.json(setup);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const createOrUpdateLeadSetup = async (req, res) => {
  try {
    const { businessType, message } = req.body;
    
    const resellerId = req.user.role === 'reseller' ? req.user._id : (req.tenant ? req.tenant.resellerId : null);
    const tenantId = req.tenant ? req.tenant._id : null;

    if (!businessType || !message) {
      return res.status(400).json({ error: 'Business type and message are required' });
    }

    let bannerImage = undefined;

    if (req.file) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'leads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `lead-banner-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(req.file.originalname)}`;
      const filePath = path.join(uploadDir, filename);
      
      fs.writeFileSync(filePath, req.file.buffer);
      bannerImage = `/uploads/leads/${filename}`;
    }

    const updateData = { message };
    if (bannerImage) {
      updateData.bannerImage = bannerImage;
    } else if (req.body.removeImage === 'true') {
      updateData.bannerImage = '';
    }

    const setup = await LeadSetup.findOneAndUpdate(
      { businessType, resellerId, tenantId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    res.json(setup);
  } catch (error) {
    console.error('Lead Setup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const deleteLeadSetup = async (req, res) => {
  try {
    const { id } = req.params;
    await LeadSetup.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
