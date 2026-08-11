import express from 'express';
import LaundryService from '../models/LaundryService.js';
import { protect, tenantFilter, checkPermission, requireBusinessType } from '../middleware/auth.js';
import sharp from 'sharp';
import { imageUpload } from '../utils/uploadMime.js';
import { saveUploadBuffer } from '../utils/objectStorage.js';

const router = express.Router();
const upload = imageUpload;

router.use(protect);
router.use(tenantFilter);
router.use(requireBusinessType('laundry'));

// POST /api/laundry/services/upload-image
router.post('/upload-image', checkPermission('laundry', 'write'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const tenantIdStr = req.user.tenantId.toString();
    const filename = `laundry-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
    const key = `laundry/${tenantIdStr}/${filename}`;

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
    console.error('Laundry image upload error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// GET /api/laundry/services
router.get('/', checkPermission('laundry', 'read'), async (req, res) => {
  try {
    const { category, isActive } = req.query;
    const query = { tenantId: req.tenant._id };
    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const services = await LaundryService.find(query).sort({ category: 1, nameEn: 1 });
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/laundry/services/seed
router.post('/seed', checkPermission('laundry', 'create'), async (req, res) => {
  try {
    const existingCount = await LaundryService.countDocuments({ tenantId: req.tenant._id, isActive: true });
    if (existingCount > 0) {
      return res.status(400).json({ error: 'Services already seeded' });
    }

    const defaultServicesRaw = [
      {
        nameEn: 'Thobe (Traditional)',
        nameAr: 'ثوب تقليدي',
        category: 'clothes',
        billingType: 'per_piece',
        basePrice: 7,
        imgName: 'thobe',
        treatments: [
          { nameEn: 'Wash & Iron', nameAr: 'غسيل وكوي', price: 7 },
          { nameEn: 'Dry Clean', nameAr: 'تنظيف جاف', price: 12 },
          { nameEn: 'Iron Only', nameAr: 'كوي فقط', price: 4 }
        ]
      },
      {
        nameEn: 'Abaya',
        nameAr: 'عباية',
        category: 'clothes',
        billingType: 'per_piece',
        basePrice: 12,
        imgName: 'abaya',
        treatments: [
          { nameEn: 'Wash & Iron', nameAr: 'غسيل وكوي', price: 12 },
          { nameEn: 'Dry Clean', nameAr: 'تنظيف جاف', price: 15 },
          { nameEn: 'Iron Only', nameAr: 'كوي فقط', price: 6 }
        ]
      },
      {
        nameEn: 'Shemagh',
        nameAr: 'شماغ',
        category: 'clothes',
        billingType: 'per_piece',
        basePrice: 5,
        imgName: 'shemagh',
        treatments: [
          { nameEn: 'Wash & Iron', nameAr: 'غسيل وكوي', price: 5 },
          { nameEn: 'Iron Only', nameAr: 'كوي فقط', price: 3 }
        ]
      },
      {
        nameEn: 'Shirt',
        nameAr: 'قميص',
        category: 'clothes',
        billingType: 'per_piece',
        basePrice: 5,
        imgName: 'shirt',
        treatments: [
          { nameEn: 'Wash & Iron', nameAr: 'غسيل وكوي', price: 5 },
          { nameEn: 'Dry Clean', nameAr: 'تنظيف جاف', price: 10 },
          { nameEn: 'Iron Only', nameAr: 'كوي فقط', price: 3 },
          { nameEn: 'Wash & Fold', nameAr: 'غسيل وطي', price: 4 }
        ]
      },
      {
        nameEn: 'T-Shirt',
        nameAr: 'تي شيرت',
        category: 'clothes',
        billingType: 'per_piece',
        basePrice: 3,
        imgName: 'tshirt',
        treatments: [
          { nameEn: 'Wash & Fold', nameAr: 'غسيل وطي', price: 3 },
          { nameEn: 'Wash & Iron', nameAr: 'غسيل وكوي', price: 4 },
          { nameEn: 'Dry Clean', nameAr: 'تنظيف جاف', price: 7 }
        ]
      },
      {
        nameEn: 'Pants / Trousers',
        nameAr: 'بنطلون',
        category: 'clothes',
        billingType: 'per_piece',
        basePrice: 6,
        imgName: 'pants',
        treatments: [
          { nameEn: 'Wash & Iron', nameAr: 'غسيل وكوي', price: 6 },
          { nameEn: 'Dry Clean', nameAr: 'تنظيف جاف', price: 8 },
          { nameEn: 'Iron Only', nameAr: 'كوي فقط', price: 4 }
        ]
      },
      {
        nameEn: 'Suit (2 Piece)',
        nameAr: 'بدلة قطعتين',
        category: 'clothes',
        billingType: 'per_piece',
        basePrice: 25,
        imgName: 'suit',
        treatments: [
          { nameEn: 'Dry Clean', nameAr: 'تنظيف جاف', price: 25 },
          { nameEn: 'Pressing', nameAr: 'كبس فقط', price: 15 }
        ]
      },
      {
        nameEn: 'Dress',
        nameAr: 'فستان',
        category: 'clothes',
        billingType: 'per_piece',
        basePrice: 20,
        imgName: 'dress',
        treatments: [
          { nameEn: 'Dry Clean', nameAr: 'تنظيف جاف', price: 20 },
          { nameEn: 'Wash & Iron', nameAr: 'غسيل وكوي', price: 18 }
        ]
      },
      {
        nameEn: 'Jacket / Coat',
        nameAr: 'جاكيت / معطف',
        category: 'clothes',
        billingType: 'per_piece',
        basePrice: 18,
        imgName: 'jacket',
        treatments: [
          { nameEn: 'Dry Clean', nameAr: 'تنظيف جاف', price: 18 },
          { nameEn: 'Pressing', nameAr: 'كبس فقط', price: 10 }
        ]
      },
      {
        nameEn: 'Blanket / Comforter',
        nameAr: 'بطانية / لحاف',
        category: 'bedding',
        billingType: 'per_piece',
        basePrice: 30,
        imgName: 'blanket',
        treatments: [
          { nameEn: 'Wash & Fold', nameAr: 'غسيل وطي', price: 30 },
          { nameEn: 'Dry Clean', nameAr: 'تنظيف جاف', price: 40 }
        ]
      },
      {
        nameEn: 'Carpet',
        nameAr: 'سجاد',
        category: 'carpets',
        billingType: 'per_sqm',
        basePrice: 15,
        imgName: 'carpet',
        treatments: [
          { nameEn: 'Wash', nameAr: 'غسيل سجاد', price: 15 }
        ]
      },
      {
        nameEn: 'Curtains',
        nameAr: 'ستائر',
        category: 'accessories',
        billingType: 'per_kg',
        basePrice: 15,
        imgName: 'curtains',
        treatments: [
          { nameEn: 'Wash & Fold', nameAr: 'غسيل وطي ستائر', price: 15 }
        ]
      }
    ];

    const defaultServices = defaultServicesRaw.map(s => {
      const { imgName, ...rest } = s;
      return {
        ...rest,
        imageUrl: `/images/laundry/${imgName}.webp`
      };
    });

    const servicesToInsert = defaultServices.map(s => ({
      ...s,
      tenantId: req.tenant._id,
      createdBy: req.user._id
    }));

    const inserted = await LaundryService.insertMany(servicesToInsert);
    res.status(201).json(inserted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/laundry/services
router.post('/', checkPermission('laundry', 'create'), async (req, res) => {
  try {
    const service = new LaundryService({
      ...req.body,
      tenantId: req.tenant._id,
      createdBy: req.user._id
    });
    await service.save();
    res.status(201).json(service);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/laundry/services/:id
router.put('/:id', checkPermission('laundry', 'update'), async (req, res) => {
  try {
    const service = await LaundryService.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json(service);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/laundry/services/:id
router.delete('/:id', checkPermission('laundry', 'delete'), async (req, res) => {
  try {
    const service = await LaundryService.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { isActive: false },
      { new: true }
    );
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json({ message: 'Service deactivated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
