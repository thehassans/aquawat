import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import RestaurantMenuItem from '../models/RestaurantMenuItem.js';
import { protect, tenantFilter, checkPermission, requireBusinessType } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import { saveUploadBuffer } from '../utils/objectStorage.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(String(file?.mimetype || '').toLowerCase());
    cb(ok ? null : new Error('Only image uploads are allowed'), ok);
  },
});

router.use(protect);
router.use(tenantFilter);
router.use(requireBusinessType('restaurant'));

async function copyDefaultMenuImage(tenantIdStr, defaultsDir, localImage) {
  const sourceImg = path.join(defaultsDir, localImage);
  if (!fs.existsSync(sourceImg)) return '';
  const buffer = await fs.promises.readFile(sourceImg);
  const key = `restaurant/${tenantIdStr}/${localImage}`;
  const { url } = await saveUploadBuffer({
    buffer,
    key,
    contentType: 'image/png',
    publicUrlPath: `/uploads/${key}`,
  });
  return url;
}

router.get('/', checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 50, search, category, isActive = 'true' } = req.query;

    const query = { ...req.tenantFilter };

    if (isActive === 'false') query.isActive = false;
    else if (isActive === 'all') {
    } else query.isActive = true;

    if (category) query.category = category;

    if (search) {
      query.$or = [
        { sku: { $regex: search, $options: 'i' } },
        { nameEn: { $regex: search, $options: 'i' } },
        { nameAr: { $regex: search, $options: 'i' } },
      ];
    }

    const items = await RestaurantMenuItem.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await RestaurantMenuItem.countDocuments(query);

    res.json({
      items,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', checkPermission('restaurant', 'read'), async (req, res) => {
  try {
    const item = await RestaurantMenuItem.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', checkTrialLimits('restaurantMenuItems'), checkPermission('restaurant', 'create'), async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(400).json({ error: 'No tenant associated with user' });
    }

    const item = await RestaurantMenuItem.create({
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    });

    res.status(201).json(item);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Duplicate SKU' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Bulk Insert Endpoint
router.post('/bulk', checkTrialLimits('restaurantMenuItems'), checkPermission('restaurant', 'create'), async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(400).json({ error: 'No tenant associated with user' });
    }

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    const itemsToInsert = items.map(item => ({
      ...item,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
      sku: item.sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    }));

    const inserted = await RestaurantMenuItem.insertMany(itemsToInsert);
    res.status(201).json({ success: true, count: inserted.length, items: inserted });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Duplicate SKU found in bulk items' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Image Upload Endpoint
router.post('/upload-image', checkPermission('restaurant', 'create'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const tenantIdStr = req.user.tenantId.toString();
    const filename = `menu-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
    const key = `restaurant/${tenantIdStr}/${filename}`;

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
    console.error('Image processing error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

router.put('/:id', checkPermission('restaurant', 'update'), async (req, res) => {
  try {
    const item = await RestaurantMenuItem.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      req.body,
      { new: true, runValidators: true }
    );

    if (!item) return res.status(404).json({ error: 'Menu item not found' });

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', checkPermission('restaurant', 'delete'), async (req, res) => {
  try {
    const item = await RestaurantMenuItem.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false },
      { new: true }
    );

    if (!item) return res.status(404).json({ error: 'Menu item not found' });

    res.json({ message: 'Menu item deactivated', item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seed Drinks Endpoint
router.post('/seed-drinks', checkPermission('restaurant', 'create'), async (req, res) => {
  try {
    const tenantIdStr = req.user.tenantId.toString();
    const defaultsDir = path.join(process.cwd(), 'public', 'defaults', 'drinks');

    const drinks = [
      {
        sku: 'DRK-001', nameEn: 'Saudi Champagne', nameAr: 'شامبانيا سعودي', descriptionEn: 'A refreshing, sparkling mix of apple and soda with fresh fruits and mint.', descriptionAr: 'مزيج منعش من التفاح والمياه الغازية مع الفواكه الطازجة والنعناع.', category: 'Cold Drinks', sellingPrice: 45, taxRate: 15, hasHalfPlate: false, calories: 120, prepTime: 5, isActive: true, localImage: 'saudi_champagne.png'
      },
      {
        sku: 'DRK-002', nameEn: 'Lemon Mint', nameAr: 'ليمون نعناع', descriptionEn: 'Freshly squeezed lemon juice blended with fresh mint leaves and ice.', descriptionAr: 'عصير ليمون طازج ممزوج بأوراق النعناع الطازجة والثلج.', category: 'Cold Drinks', sellingPrice: 22, taxRate: 15, hasHalfPlate: false, calories: 90, prepTime: 5, isActive: true, localImage: 'lemon_mint.png'
      },
      {
        sku: 'DRK-003', nameEn: 'Dates Milkshake', nameAr: 'ميلك شيك التمر', descriptionEn: 'Creamy and rich milkshake made with premium Saudi dates.', descriptionAr: 'ميلك شيك كريمي وغني محضر من أجود أنواع التمور السعودية.', category: 'Cold Drinks', sellingPrice: 28, taxRate: 15, hasHalfPlate: false, calories: 320, prepTime: 5, isActive: true, localImage: 'dates_milkshake.png'
      },
      {
        sku: 'DRK-004', nameEn: 'Vimto Ice', nameAr: 'فيمتو مثلج', descriptionEn: 'The classic berry beverage served ice-cold, a local favorite.', descriptionAr: 'مشروب التوت الكلاسيكي يقدم بارداً جداً، المفضل محلياً.', category: 'Cold Drinks', sellingPrice: 18, taxRate: 15, hasHalfPlate: false, calories: 150, prepTime: 3, isActive: true, localImage: 'vimto_drink.png'
      },
      {
        sku: 'DRK-005', nameEn: 'Pepsi Can', nameAr: 'بيبسي علبة', descriptionEn: 'Cold tin can of Pepsi cola.', descriptionAr: 'علبة بيبسي باردة.', category: 'Cold Drinks', sellingPrice: 8, taxRate: 15, hasHalfPlate: false, calories: 150, prepTime: 1, isActive: true, localImage: 'pepsi_can.png'
      },
      {
        sku: 'DRK-006', nameEn: '7Up Can', nameAr: 'سفن اب علبة', descriptionEn: 'Cold tin can of 7Up lemon-lime soda.', descriptionAr: 'علبة سفن اب باردة.', category: 'Cold Drinks', sellingPrice: 8, taxRate: 15, hasHalfPlate: false, calories: 140, prepTime: 1, isActive: true, localImage: 'seven_up_can.png'
      },
      {
        sku: 'DRK-007', nameEn: 'Coca-Cola Can', nameAr: 'كوكاكولا علبة', descriptionEn: 'Cold tin can of Coca-Cola.', descriptionAr: 'علبة كوكاكولا باردة.', category: 'Cold Drinks', sellingPrice: 8, taxRate: 15, hasHalfPlate: false, calories: 140, prepTime: 1, isActive: true, localImage: 'coke_can.png'
      },
      {
        sku: 'DRK-008', nameEn: 'Mirinda Orange Can', nameAr: 'ميريندا برتقال علبة', descriptionEn: 'Cold tin can of Mirinda Orange soda.', descriptionAr: 'علبة ميريندا برتقال باردة.', category: 'Cold Drinks', sellingPrice: 8, taxRate: 15, hasHalfPlate: false, calories: 150, prepTime: 1, isActive: true, localImage: 'mirinda_orange_can.png'
      },
      {
        sku: 'DRK-009', nameEn: 'Mirinda Citrus Can', nameAr: 'ميريندا حمضيات علبة', descriptionEn: 'Cold tin can of Mirinda Citrus soda.', descriptionAr: 'علبة ميريندا حمضيات باردة.', category: 'Cold Drinks', sellingPrice: 8, taxRate: 15, hasHalfPlate: false, calories: 150, prepTime: 1, isActive: true, localImage: 'mirinda_citrus_can.png'
      },
      {
        sku: 'DRK-010', nameEn: 'Fanta Orange Can', nameAr: 'فانتا برتقال علبة', descriptionEn: 'Cold tin can of Fanta Orange soda.', descriptionAr: 'علبة فانتا برتقال باردة.', category: 'Cold Drinks', sellingPrice: 8, taxRate: 15, hasHalfPlate: false, calories: 150, prepTime: 1, isActive: true, localImage: 'fanta_orange_can.png'
      },
      {
        sku: 'DRK-011', nameEn: 'Fanta Strawberry Can', nameAr: 'فانتا فراولة علبة', descriptionEn: 'Cold tin can of Fanta Strawberry soda.', descriptionAr: 'علبة فانتا فراولة باردة.', category: 'Cold Drinks', sellingPrice: 8, taxRate: 15, hasHalfPlate: false, calories: 160, prepTime: 1, isActive: true, localImage: 'fanta_strawberry_can.png'
      },
      {
        sku: 'DRK-012', nameEn: 'Pepsi Large (2.25L)', nameAr: 'بيبسي عائلي (2.25 لتر)', descriptionEn: 'Large family-size bottle of Pepsi.', descriptionAr: 'زجاجة بيبسي حجم عائلي كبير.', category: 'Cold Drinks', sellingPrice: 20, taxRate: 15, hasHalfPlate: false, calories: 950, prepTime: 1, isActive: true, localImage: 'pepsi_large.png'
      },
      {
        sku: 'DRK-013', nameEn: '7Up Large (2.25L)', nameAr: 'سفن اب عائلي (2.25 لتر)', descriptionEn: 'Large family-size bottle of 7Up.', descriptionAr: 'زجاجة سفن اب حجم عائلي كبير.', category: 'Cold Drinks', sellingPrice: 20, taxRate: 15, hasHalfPlate: false, calories: 900, prepTime: 1, isActive: true, localImage: 'seven_up_large.png'
      },
      {
        sku: 'DRK-014', nameEn: 'Coca-Cola Large (2.25L)', nameAr: 'كوكاكولا عائلي (2.25 لتر)', descriptionEn: 'Large family-size bottle of Coca-Cola.', descriptionAr: 'زجاجة كوكاكولا حجم عائلي كبير.', category: 'Cold Drinks', sellingPrice: 20, taxRate: 15, hasHalfPlate: false, calories: 950, prepTime: 1, isActive: true, localImage: 'coke_large.png'
      },
      {
        sku: 'DRK-015', nameEn: 'Mirinda Orange Large (2.25L)', nameAr: 'ميريندا برتقال عائلي (2.25 لتر)', descriptionEn: 'Large family-size bottle of Mirinda Orange.', descriptionAr: 'زجاجة ميريندا برتقال حجم عائلي كبير.', category: 'Cold Drinks', sellingPrice: 20, taxRate: 15, hasHalfPlate: false, calories: 980, prepTime: 1, isActive: true, localImage: 'mirinda_orange_large.png'
      },
      {
        sku: 'DRK-016', nameEn: 'Fanta Orange Large (2.25L)', nameAr: 'فانتا برتقال عائلي (2.25 لتر)', descriptionEn: 'Large family-size bottle of Fanta Orange.', descriptionAr: 'زجاجة فانتا برتقال حجم عائلي كبير.', category: 'Cold Drinks', sellingPrice: 20, taxRate: 15, hasHalfPlate: false, calories: 980, prepTime: 1, isActive: true, localImage: 'fanta_orange_large.png'
      }
    ];

    for (const drink of drinks) {
      const sourceImg = path.join(defaultsDir, drink.localImage);
      let imageUrl = '';
      if (fs.existsSync(sourceImg)) {
        imageUrl = await copyDefaultMenuImage(tenantIdStr, defaultsDir, drink.localImage);
      }

      await RestaurantMenuItem.findOneAndUpdate(
        { tenantId: req.user.tenantId, sku: drink.sku },
        {
          tenantId: req.user.tenantId,
          sku: drink.sku,
          nameEn: drink.nameEn,
          nameAr: drink.nameAr,
          descriptionEn: drink.descriptionEn,
          descriptionAr: drink.descriptionAr,
          category: drink.category,
          sellingPrice: drink.sellingPrice,
          taxRate: drink.taxRate,
          hasHalfPlate: drink.hasHalfPlate,
          calories: drink.calories,
          prepTime: drink.prepTime,
          isActive: drink.isActive,
          imageUrl: imageUrl || ''
        },
        { upsert: true, new: true }
      );
    }

    res.json({ message: 'Drinks seeded successfully' });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: 'Failed to seed drinks' });
  }
});

// Seed Food Endpoint
router.post('/seed-food', checkPermission('restaurant', 'create'), async (req, res) => {
  try {
    const tenantIdStr = req.user.tenantId.toString();
    const defaultsDir = path.join(process.cwd(), 'public', 'defaults', 'food');

    const foods = [
      // Arabic Category
      { sku: 'FOD-A01', nameEn: 'Kabsa Chicken', nameAr: 'كبسة دجاج', descriptionEn: 'Traditional Saudi rice dish cooked with spiced chicken.', descriptionAr: 'طبق أرز سعودي تقليدي مطبوخ مع الدجاج المبهر.', category: 'Arabic', sellingPrice: 35, taxRate: 15, hasHalfPlate: true, calories: 650, prepTime: 25, isActive: true, localImage: 'kabsa_chicken.png' },
      { sku: 'FOD-A02', nameEn: 'Mandi Meat', nameAr: 'مندي لحم', descriptionEn: 'Smoked slow-cooked meat with fragrant rice.', descriptionAr: 'لحم مطبوخ ببطء ومدخن مع الأرز العطري.', category: 'Arabic', sellingPrice: 65, taxRate: 15, hasHalfPlate: true, calories: 850, prepTime: 30, isActive: true, localImage: 'mandi_meat.png' },
      { sku: 'FOD-A03', nameEn: 'Hummus', nameAr: 'حمص', descriptionEn: 'Creamy chickpea dip with tahini and olive oil.', descriptionAr: 'تغميسة حمص كريمية مع الطحينة وزيت الزيتون.', category: 'Arabic', sellingPrice: 15, taxRate: 15, hasHalfPlate: false, calories: 220, prepTime: 5, isActive: true, localImage: 'hummus.png' },
      // Indian Category
      { sku: 'FOD-I01', nameEn: 'Butter Chicken', nameAr: 'دجاج بالزبدة', descriptionEn: 'Tender chicken in a rich, creamy tomato gravy.', descriptionAr: 'دجاج طري في مرق الطماطم الغني والكريمي.', category: 'Indian', sellingPrice: 40, taxRate: 15, hasHalfPlate: false, calories: 550, prepTime: 20, isActive: true, localImage: 'butter_chicken.png' },
      { sku: 'FOD-I02', nameEn: 'Chicken Biryani', nameAr: 'برياني دجاج', descriptionEn: 'Aromatic basmati rice cooked with spiced chicken.', descriptionAr: 'أرز بسمتي عطري مطبوخ مع الدجاج المبهر.', category: 'Indian', sellingPrice: 38, taxRate: 15, hasHalfPlate: true, calories: 600, prepTime: 25, isActive: true, localImage: 'chicken_biryani.png' },
      { sku: 'FOD-I03', nameEn: 'Garlic Naan', nameAr: 'خبز نان بالثوم', descriptionEn: 'Freshly baked flatbread with garlic and butter.', descriptionAr: 'خبز طازج بالثوم والزبدة.', category: 'Indian', sellingPrice: 5, taxRate: 15, hasHalfPlate: false, calories: 150, prepTime: 10, isActive: true, localImage: 'garlic_naan.png' },
      // Continental Category
      { sku: 'FOD-C01', nameEn: 'Grilled Salmon', nameAr: 'سلمون مشوي', descriptionEn: 'Fresh salmon fillet served with roasted vegetables.', descriptionAr: 'فيليه سلمون طازج يقدم مع خضار مشوية.', category: 'Continental', sellingPrice: 85, taxRate: 15, hasHalfPlate: false, calories: 450, prepTime: 30, isActive: true, localImage: 'grilled_salmon.png' },
      { sku: 'FOD-C02', nameEn: 'Beef Steak', nameAr: 'ستيك لحم بقري', descriptionEn: 'Juicy ribeye steak cooked to your liking.', descriptionAr: 'شريحة لحم ريب آي طرية مطبوخة حسب رغبتك.', category: 'Continental', sellingPrice: 120, taxRate: 15, hasHalfPlate: false, calories: 750, prepTime: 25, isActive: true, localImage: 'beef_steak.png' },
      { sku: 'FOD-C03', nameEn: 'Caesar Salad', nameAr: 'سلطة سيزر', descriptionEn: 'Crisp romaine lettuce with croutons, parmesan, and Caesar dressing.', descriptionAr: 'خس رومين مقرمش مع الخبز المحمص والبارميزان وصلصة السيزر.', category: 'Continental', sellingPrice: 28, taxRate: 15, hasHalfPlate: false, calories: 320, prepTime: 10, isActive: true, localImage: 'caesar_salad.png' },
    ];

    for (const food of foods) {
      const sourceImg = path.join(defaultsDir, food.localImage);
      let imageUrl = '';
      if (fs.existsSync(sourceImg)) {
        imageUrl = await copyDefaultMenuImage(tenantIdStr, defaultsDir, food.localImage);
      }

      await RestaurantMenuItem.findOneAndUpdate(
        { tenantId: req.user.tenantId, sku: food.sku },
        {
          tenantId: req.user.tenantId,
          sku: food.sku,
          nameEn: food.nameEn,
          nameAr: food.nameAr,
          descriptionEn: food.descriptionEn,
          descriptionAr: food.descriptionAr,
          category: food.category,
          sellingPrice: food.sellingPrice,
          taxRate: food.taxRate,
          hasHalfPlate: food.hasHalfPlate,
          calories: food.calories,
          prepTime: food.prepTime,
          isActive: food.isActive,
          imageUrl: imageUrl || ''
        },
        { upsert: true, new: true }
      );
    }

    res.json({ message: 'Food seeded successfully' });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: 'Failed to seed food' });
  }
});

export default router;
