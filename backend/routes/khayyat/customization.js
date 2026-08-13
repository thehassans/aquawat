import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import KhayyatCustomization from '../../models/khayyat/KhayyatCustomization.js';
import { protect } from '../../middleware/auth.js';
import { saveUploadBuffer } from '../../utils/objectStorage.js';

const router = express.Router();

const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.use(protect);

async function saveCustomizationImage(tenantId, category, buffer) {
  const tenantIdStr = String(tenantId);
  const filename = `${category || 'custom'}-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
  const key = `khayyat/customizations/${tenantIdStr}/${filename}`;
  const webp = await sharp(buffer)
    .resize({ width: 300, height: 300, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .webp({ quality: 85 })
    .toBuffer();
  const { url } = await saveUploadBuffer({
    buffer: webp,
    key,
    contentType: 'image/webp',
    publicUrlPath: `/uploads/${key}`,
  });
  return url;
}

// GET /api/khayyat/customizations
router.get('/', async (req, res) => {
  try {
    const filter = { tenantId: req.user.tenantId };
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    let customizations = await KhayyatCustomization.find(filter)
      .sort({ sortOrder: 1, createdAt: -1 });
      
    // Seed defaults for any missing categories
    if (!req.query.category) {
      const defaultGroups = [
        { category: 'collar', options: [
          { key: 'classic', en: 'Classic', ar: 'كلاسيك', image: '/thawbs/styles/collar_classic.webp' },
          { key: 'round', en: 'Round', ar: 'دائري', image: '/thawbs/styles/collar_round.webp' },
          { key: 'mandarin', en: 'Mandarin', ar: 'يوسفي', image: '/thawbs/styles/collar_mandarin.webp' },
          { key: 'open', en: 'Open', ar: 'مفتوح', image: '/thawbs/styles/collar_open.webp' },
          { key: 'v_neck', en: 'V-Neck', ar: 'رقبة V', image: '/thawbs/styles/collar_v_neck.webp' },
          { key: 'chinese', en: 'Chinese', ar: 'صيني', image: '/thawbs/styles/collar_chinese.webp' }
        ]},
        { category: 'bain', options: [
          { key: 'hidden', en: 'Hidden', ar: 'مخفي', image: '/thawbs/styles/bain_hidden.webp' },
          { key: 'visible', en: 'Visible', ar: 'ظاهر', image: '/thawbs/styles/bain_visible.webp' },
          { key: 'zip', en: 'Zip', ar: 'سحاب', image: '/thawbs/styles/bain_zip.webp' },
          { key: 'half', en: 'Half', ar: 'نصف', image: '/thawbs/styles/bain_half.webp' },
          { key: 'full', en: 'Full', ar: 'كامل', image: '/thawbs/styles/bain_full.webp' }
        ]},
        { category: 'cuff', options: [
          { key: 'single', en: 'Single', ar: 'سادة', image: '/thawbs/styles/cuff_single.webp' },
          { key: 'double', en: 'Double', ar: 'مزدوج (كبك)', image: '/thawbs/styles/cuff_double.webp' },
          { key: 'round', en: 'Round', ar: 'دائري', image: '/thawbs/styles/cuff_round.webp' },
          { key: 'angled', en: 'Angled', ar: 'مشطوف', image: '/thawbs/styles/cuff_angled.webp' },
          { key: 'wide', en: 'Wide', ar: 'عريض', image: '/thawbs/styles/cuff_wide.webp' }
        ]},
        { category: 'pocket', options: [
          { key: 'none', en: 'None', ar: 'بدون', image: '/thawbs/styles/pocket_none.webp' },
          { key: 'chest', en: 'Chest', ar: 'صدر', image: '/thawbs/styles/pocket_chest.webp' },
          { key: 'side', en: 'Side', ar: 'جانبي', image: '/thawbs/styles/pocket_side.webp' },
          { key: 'both', en: 'Both', ar: 'صدر وجانبي', image: '/thawbs/styles/pocket_both.webp' }
        ]},
        { category: 'buttons', options: [
          { key: 'classic', en: 'Classic', ar: 'كلاسيك', image: '/thawbs/styles/buttons_classic.webp' },
          { key: 'hidden', en: 'Hidden', ar: 'مخفي', image: '/thawbs/styles/buttons_hidden.webp' },
          { key: 'snap', en: 'Snap (Tek-tak)', ar: 'طقطق', image: '/thawbs/styles/buttons_snap.webp' },
          { key: 'premium', en: 'Premium', ar: 'ممتاز', image: '/thawbs/styles/buttons_premium.webp' },
          { key: 'golden', en: 'Golden', ar: 'ذهبي', image: '/thawbs/styles/buttons_golden.webp' }
        ]},
        { category: 'embroidery', options: [
          { key: 'none', en: 'None', ar: 'بدون', image: '/thawbs/styles/embroidery_none.webp' },
          { key: 'name', en: 'Name Initials', ar: 'حروف الاسم', image: '/thawbs/styles/embroidery_name.webp' },
          { key: 'logo', en: 'Logo', ar: 'شعار', image: null },
          { key: 'premium', en: 'Premium Design', ar: 'تصميم مميز', image: null },
          { key: 'arabic', en: 'Arabic Calligraphy', ar: 'خط عربي', image: null }
        ]},
        { category: 'fabricColor', options: [
          { key: 'white', en: 'White', ar: 'أبيض', image: null },
          { key: 'cream', en: 'Cream', ar: 'كريمي', image: null },
          { key: 'offwhite', en: 'Off White', ar: 'أوف وايت', image: null },
          { key: 'beige', en: 'Beige', ar: 'بيج', image: null },
          { key: 'grey', en: 'Grey', ar: 'رمادي', image: null },
          { key: 'black', en: 'Black', ar: 'أسود', image: null },
          { key: 'navy', en: 'Navy', ar: 'كحلي', image: null },
          { key: 'brown', en: 'Brown', ar: 'بني', image: null }
        ]},
        { category: 'thawbType', options: [
          { key: 'saudi', en: 'Saudi', ar: 'سعودي', image: '/thawbs/saudi.webp' },
          { key: 'qatari', en: 'Qatari', ar: 'قطري', image: '/thawbs/qatari.webp' },
          { key: 'emirati', en: 'Emirati', ar: 'إماراتي', image: '/thawbs/emirati.webp' },
          { key: 'kuwaiti', en: 'Kuwaiti', ar: 'كويتي', image: '/thawbs/kuwati.webp' },
          { key: 'omani', en: 'Omani', ar: 'عماني', image: '/thawbs/omani.webp' },
          { key: 'bahraini', en: 'Bahraini', ar: 'بحريني', image: '/thawbs/Bahrini.webp' },
          { key: 'noum', en: 'Noum', ar: 'نوم', image: '/thawbs/noum.webp' }
        ]}
      ];

      const existingCategories = new Set(customizations.map(c => c.category));
      const seedData = [];

      defaultGroups.forEach(group => {
        if (!existingCategories.has(group.category)) {
          group.options.forEach((opt, idx) => {
            seedData.push({
              tenantId: req.user.tenantId,
              category: group.category,
              nameEn: opt.en,
              nameAr: opt.ar,
              image: opt.image,
              extraPrice: 0,
              isActive: true,
              sortOrder: idx
            });
          });
        }
      });
      if (seedData.length > 0) {
        await KhayyatCustomization.insertMany(seedData);
        customizations = await KhayyatCustomization.find(filter)
          .sort({ sortOrder: 1, createdAt: -1 });
      }
    }
    res.json({ success: true, customizations });
  } catch (error) {
    console.error('Fetch customizations error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/khayyat/customizations
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { category, nameEn, nameAr, extraPrice, isActive, sortOrder, image: bodyImage } = req.body;
    
    if (!category || !nameEn || !nameAr) {
      return res.status(400).json({ success: false, error: 'Category, English Name, and Arabic Name are required' });
    }

    let imageUrl = bodyImage || null;

    if (req.file) {
      imageUrl = await saveCustomizationImage(req.user.tenantId, category, req.file.buffer);
    }

    const customization = new KhayyatCustomization({
      tenantId: req.user.tenantId,
      category,
      nameEn,
      nameAr,
      image: imageUrl,
      extraPrice: Number(extraPrice) || 0,
      isActive: isActive === 'false' ? false : true,
      sortOrder: Number(sortOrder) || 0
    });

    await customization.save();
    res.status(201).json({ success: true, customization });
  } catch (error) {
    console.error('Create customization error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PUT /api/khayyat/customizations/:id
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const customization = await KhayyatCustomization.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!customization) {
      return res.status(404).json({ success: false, error: 'Customization not found' });
    }

    const { category, nameEn, nameAr, extraPrice, isActive, sortOrder, image: bodyImage } = req.body;
    let imageUrl = bodyImage || null;

    if (category) customization.category = category;
    if (nameEn) customization.nameEn = nameEn;
    if (nameAr) customization.nameAr = nameAr;
    if (extraPrice !== undefined) customization.extraPrice = Number(extraPrice) || 0;
    if (isActive !== undefined) customization.isActive = isActive === 'false' ? false : true;
    if (sortOrder !== undefined) customization.sortOrder = Number(sortOrder) || 0;

    if (req.file) {
      imageUrl = await saveCustomizationImage(req.user.tenantId, customization.category, req.file.buffer);
    }
    
    if (imageUrl) {
      customization.image = imageUrl;
    } else if (req.body.removeImage === 'true') {
      customization.image = null;
    }

    await customization.save();
    res.json({ success: true, customization });
  } catch (error) {
    console.error('Update customization error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE /api/khayyat/customizations/:id
router.delete('/:id', async (req, res) => {
  try {
    const customization = await KhayyatCustomization.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!customization) {
      return res.status(404).json({ success: false, error: 'Customization not found' });
    }
    // Note: We leave the old image file to save logic complexity and prevent broken references 
    // if it was used in historical orders.
    
    res.json({ success: true, message: 'Customization deleted' });
  } catch (error) {
    console.error('Delete customization error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
