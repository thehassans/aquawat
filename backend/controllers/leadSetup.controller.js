import fs from 'fs';
import path from 'path';
import LeadSetup from '../models/LeadSetup.js';

export const getLeadSetups = async (req, res) => {
  try {
    const setups = await LeadSetup.find();
    res.json(setups);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const getLeadSetupByType = async (req, res) => {
  try {
    const { type } = req.params;
    const setup = await LeadSetup.findOne({ businessType: type });
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
    }

    const setup = await LeadSetup.findOneAndUpdate(
      { businessType },
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
