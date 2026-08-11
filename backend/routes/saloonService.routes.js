import express from 'express';
import { protect, tenantFilter, checkPermission, requireBusinessType } from '../middleware/auth.js';
import SaloonService from '../models/SaloonService.js';
import multer from 'multer';
import sharp from 'sharp';
import { saveUploadBuffer } from '../utils/objectStorage.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);
router.use(tenantFilter);
router.use(requireBusinessType('saloon'));

// @route   POST /api/saloon/services/upload-image
router.post('/upload-image', checkPermission('saloon', 'write'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const tenantIdStr = req.user.tenantId.toString();
    const filename = `saloon-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
    const key = `saloon/${tenantIdStr}/${filename}`;

    const buffer = await sharp(req.file.buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const { url: imageUrl } = await saveUploadBuffer({
      buffer,
      key,
      contentType: 'image/webp',
      publicUrlPath: `/uploads/${key}`,
    });
    res.json({ imageUrl });
  } catch (error) {
    console.error('Saloon image upload error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// @route   GET /api/saloon/services
router.get('/', checkPermission('saloon', 'read'), async (req, res) => {
  try {
    const { isActive, category } = req.query;
    const query = { tenantId: req.user.tenantId };
    
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (category) query.category = category;
    
    const services = await SaloonService.find(query).sort({ category: 1, nameEn: 1 });
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/saloon/services
router.post('/', checkPermission('saloon', 'create'), async (req, res) => {
  try {
    const service = new SaloonService({
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    });
    
    await service.save();
    // Log removed
    
    res.status(201).json(service);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   PUT /api/saloon/services/:id
router.put('/:id', checkPermission('saloon', 'update'), async (req, res) => {
  try {
    const service = await SaloonService.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!service) return res.status(404).json({ error: 'Service not found' });
    
    // Log removed
    res.json(service);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   DELETE /api/saloon/services/:id
router.delete('/:id', checkPermission('saloon', 'delete'), async (req, res) => {
  try {
    const service = await SaloonService.findOneAndDelete({ 
      _id: req.params.id, 
      tenantId: req.user.tenantId 
    });
    
    if (!service) return res.status(404).json({ error: 'Service not found' });
    
    // Log removed
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/saloon/services/seed
router.post('/seed', checkPermission('saloon', 'create'), async (req, res) => {
  try {
    const existing = await SaloonService.countDocuments({ tenantId: req.user.tenantId });
    if (existing > 0) {
      return res.status(400).json({ error: 'Services already exist for this tenant. Cannot seed.' });
    }

    const demoServices = [
      {
        nameEn: 'Men\'s Haircut', nameAr: 'حلاقة شعر رجالي',
        category: 'Hair', durationMinutes: 30, price: 50, taxRate: 15,
        imageUrl: '/defaults/saloon/mens_haircut.png'
      },
      {
        nameEn: 'Beard Trim & Shape', nameAr: 'تحديد وتشذيب اللحية',
        category: 'Beard', durationMinutes: 20, price: 30, taxRate: 15,
        imageUrl: '/defaults/saloon/beard_trim.png'
      },
      {
        nameEn: 'Hot Towel Shave', nameAr: 'حلاقة بالمنشفة الساخنة',
        category: 'Beard', durationMinutes: 30, price: 40, taxRate: 15,
        imageUrl: '/defaults/saloon/hot_towel_shave.png'
      },
      {
        nameEn: 'Hair Dye / Color', nameAr: 'صبغة شعر',
        category: 'Hair', durationMinutes: 60, price: 100, taxRate: 15,
        imageUrl: '/defaults/saloon/hair_dye.png'
      },
      {
        nameEn: 'Facial Treatment', nameAr: 'تنظيف بشرة',
        category: 'Skin', durationMinutes: 45, price: 80, taxRate: 15,
        imageUrl: '/defaults/saloon/hot_towel_shave.png' // re-use hot towel image for facial
      },
      {
        nameEn: 'Kid\'s Haircut', nameAr: 'حلاقة أطفال',
        category: 'Hair', durationMinutes: 20, price: 35, taxRate: 15,
        imageUrl: '/defaults/saloon/mens_haircut.png' // re-use haircut image
      }
    ];

    const services = demoServices.map(s => ({
      ...s,
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    }));

    await SaloonService.insertMany(services);
    res.status(201).json({ success: true, count: services.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
