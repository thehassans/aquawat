import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { resolveTenantId, handleTenantScopeError } from '../utils/tenantScope.js';
import { protect } from '../middleware/auth.js';
import Tenant from '../models/Tenant.js';
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

const getTargetTenantId = (user, req) => resolveTenantId(user, req);

// Default theme configuration — the starting point for all new stores
const DEFAULT_THEME = {
  version: 1,
  layout: 'modern', // modern, classic, minimal
  colors: {
    primary: '#4f46e5',
    secondary: '#7c3aed',
    accent: '#ec4899',
    background: '#ffffff',
    surface: '#f9fafb',
    text: '#111827',
    textMuted: '#6b7280',
    headerBg: '#ffffff',
    footerBg: '#111827',
    footerText: '#9ca3af',
    buttonBg: '#4f46e5',
    buttonText: '#ffffff',
    priceColor: '#059669',
    salePriceColor: '#dc2626',
    borderColor: '#e5e7eb',
  },
  typography: {
    headingFont: 'Inter',
    bodyFont: 'Inter',
    headingSize: 'text-3xl',
    bodySize: 'text-base',
    headingWeight: 'font-bold',
    bodyWeight: 'font-normal',
    lineHeight: 'leading-relaxed',
  },
  header: {
    showLogo: true,
    logoText: '',
    logoImageUrl: '',
    logoSize: 34,
    showSearch: true,
    showCart: true,
    showCategories: true,
    announcementBar: {
      enabled: false,
      text: '',
      textAr: '',
      bgColor: '#4f46e5',
      textColor: '#ffffff',
    },
    sticky: true,
  },
  headerNav: {
    enabled: true,
    style: 'default', // default, centered, minimal, split
  },
  footer: {
    showAbout: true,
    aboutText: '',
    showContact: true,
    showSocialLinks: true,
    socialLinks: { instagram: '', twitter: '', facebook: '', tiktok: '', snapchat: '' },
    showPaymentIcons: true,
    copyrightText: '',
  },
  homepage: {
    sections: [
      { id: 'hero', type: 'hero', enabled: true, settings: { title: '', subtitle: '', imageUrl: '', buttonText: 'Shop Now', buttonLink: '/products' } },
      { id: 'featured', type: 'product-carousel', enabled: true, settings: { title: 'Featured Products', limit: 8 } },
      { id: 'categories', type: 'category-grid', enabled: true, settings: { title: 'Shop by Category', columns: 4 } },
      { id: 'newarrivals', type: 'product-carousel', enabled: true, settings: { title: 'New Arrivals', limit: 8 } },
      { id: 'newsletter', type: 'newsletter', enabled: false, settings: { title: 'Subscribe', subtitle: '' } },
    ],
  },
  productPage: {
    showBreadcrumbs: true,
    showRelatedProducts: true,
    relatedLimit: 4,
    showReviews: false,
    defaultImageZoom: true,
    showShareButtons: true,
  },
  cart: {
    style: 'drawer', // drawer, page, modal
    showRecommendations: true,
    freeShippingBar: true,
  },
  mobileNav: {
    enabled: true,
    style: 'default', // default, modern, spotlight, pill
  },
  darkMode: {
    enabled: false,
    colors: {
      primary: '#6366f1',
      secondary: '#8b5cf6',
      accent: '#ec4899',
      background: '#0f172a',
      surface: '#1e293b',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      headerBg: '#0f172a',
      footerBg: '#020617',
      footerText: '#64748b',
      buttonBg: '#6366f1',
      buttonText: '#ffffff',
      priceColor: '#22c55e',
      salePriceColor: '#f87171',
      borderColor: '#334155',
    },
  },
  customCss: '',
};

// GET theme config (returns draft + published)
router.get('/', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const tenant = await Tenant.findById(tenantId).select('ecommerce.theme').lean();
    const theme = tenant?.ecommerce?.theme || {};
    // Merge with defaults so the editor always has a complete config
    const draft = mergeDefaults(theme.draft || DEFAULT_THEME);
    const published = theme.published ? mergeDefaults(theme.published) : null;
    res.json({
      draft,
      published,
      draftUpdatedAt: theme.draftUpdatedAt || null,
      publishedAt: theme.publishedAt || null,
      hasUnpublishedChanges: !!theme.publishedAt && (!theme.draftUpdatedAt || new Date(theme.draftUpdatedAt) > new Date(theme.publishedAt)),
    });
  } catch (error) {
    if (handleTenantScopeError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// Save draft
router.put('/draft', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    tenant.ecommerce = tenant.ecommerce || {};
    tenant.ecommerce.theme = tenant.ecommerce.theme || {};
    tenant.ecommerce.theme.draft = req.body;
    tenant.ecommerce.theme.draftUpdatedAt = new Date();
    await tenant.save();
    res.json({ draft: mergeDefaults(tenant.ecommerce.theme.draft), draftUpdatedAt: tenant.ecommerce.theme.draftUpdatedAt });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Publish draft → published
router.post('/publish', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    tenant.ecommerce = tenant.ecommerce || {};
    tenant.ecommerce.theme = tenant.ecommerce.theme || {};
    // If no draft exists, use defaults
    const draft = tenant.ecommerce.theme.draft || DEFAULT_THEME;
    tenant.ecommerce.theme.published = draft;
    tenant.ecommerce.theme.publishedAt = new Date();
    await tenant.save();
    res.json({ published: mergeDefaults(tenant.ecommerce.theme.published), publishedAt: tenant.ecommerce.theme.publishedAt });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Reset draft to default
router.post('/reset', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    tenant.ecommerce = tenant.ecommerce || {};
    tenant.ecommerce.theme = tenant.ecommerce.theme || {};
    tenant.ecommerce.theme.draft = DEFAULT_THEME;
    tenant.ecommerce.theme.draftUpdatedAt = new Date();
    await tenant.save();
    res.json({ draft: DEFAULT_THEME, draftUpdatedAt: tenant.ecommerce.theme.draftUpdatedAt });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get defaults (for reference)
router.get('/defaults', protect, async (req, res) => {
  res.json(DEFAULT_THEME);
});

// Preset themes (Shopify-like) that users can apply with one click
const PRESET_THEMES = [
  {
    id: 'modern',
    name: 'Modern',
    nameAr: 'عصري',
    description: 'Clean indigo theme with a modern storefront.',
    preview: { primary: '#4f46e5', background: '#ffffff' },
    theme: DEFAULT_THEME,
  },
  {
    id: 'classic',
    name: 'Classic',
    nameAr: 'كلاسيكي',
    description: 'Elegant serif theme with warm tones.',
    preview: { primary: '#8b5cf6', background: '#fafaf9' },
    theme: {
      ...DEFAULT_THEME,
      layout: 'classic',
      colors: {
        ...DEFAULT_THEME.colors,
        primary: '#8b5cf6',
        secondary: '#a78bfa',
        accent: '#f59e0b',
        background: '#fafaf9',
        surface: '#f5f5f4',
        text: '#1c1917',
        textMuted: '#78716c',
        headerBg: '#fafaf9',
        footerBg: '#1c1917',
        buttonBg: '#8b5cf6',
      },
      typography: { ...DEFAULT_THEME.typography, headingFont: 'Georgia', bodyFont: 'Inter' },
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    nameAr: 'بسيط',
    description: 'Minimalist black and white theme.',
    preview: { primary: '#111827', background: '#ffffff' },
    theme: {
      ...DEFAULT_THEME,
      layout: 'minimal',
      colors: {
        ...DEFAULT_THEME.colors,
        primary: '#111827',
        secondary: '#374151',
        accent: '#06b6d4',
        background: '#ffffff',
        surface: '#f9fafb',
        text: '#111827',
        textMuted: '#6b7280',
        headerBg: '#ffffff',
        footerBg: '#111827',
        buttonBg: '#111827',
        borderColor: '#e5e7eb',
      },
      typography: { ...DEFAULT_THEME.typography, headingFont: 'Inter', bodyFont: 'Inter', headingWeight: 'font-semibold' },
    },
  },
  {
    id: 'bold',
    name: 'Bold',
    nameAr: 'جريء',
    description: 'High contrast theme with bold colors for fashion and lifestyle brands.',
    preview: { primary: '#dc2626', background: '#0f172a' },
    theme: {
      ...DEFAULT_THEME,
      layout: 'modern',
      colors: {
        ...DEFAULT_THEME.colors,
        primary: '#dc2626',
        secondary: '#7f1d1d',
        accent: '#fbbf24',
        background: '#0f172a',
        surface: '#1e293b',
        text: '#f8fafc',
        textMuted: '#94a3b8',
        headerBg: '#0f172a',
        footerBg: '#020617',
        buttonBg: '#dc2626',
        buttonText: '#ffffff',
        priceColor: '#22c55e',
        salePriceColor: '#f87171',
        borderColor: '#334155',
      },
      typography: { ...DEFAULT_THEME.typography, headingFont: 'Poppins', bodyFont: 'Inter', headingWeight: 'font-extrabold' },
    },
  },
  {
    id: 'luxury',
    name: 'Luxury',
    nameAr: 'فاخر',
    description: 'Sophisticated gold and charcoal theme for premium brands.',
    preview: { primary: '#d4af37', background: '#1a1a1a' },
    theme: {
      ...DEFAULT_THEME,
      layout: 'classic',
      colors: {
        ...DEFAULT_THEME.colors,
        primary: '#d4af37',
        secondary: '#b8860b',
        accent: '#d4af37',
        background: '#1a1a1a',
        surface: '#262626',
        text: '#f5f5f5',
        textMuted: '#a3a3a3',
        headerBg: '#1a1a1a',
        footerBg: '#0a0a0a',
        footerText: '#737373',
        buttonBg: '#d4af37',
        buttonText: '#1a1a1a',
        priceColor: '#d4af37',
        salePriceColor: '#ef4444',
        borderColor: '#404040',
      },
      typography: { ...DEFAULT_THEME.typography, headingFont: 'Playfair Display', bodyFont: 'Inter', headingWeight: 'font-bold' },
    },
  },
  {
    id: 'playful',
    name: 'Playful',
    nameAr: 'مرح',
    description: 'Fun and vibrant theme perfect for kids, toys, and creative brands.',
    preview: { primary: '#f472b6', background: '#fef3f2' },
    theme: {
      ...DEFAULT_THEME,
      layout: 'modern',
      colors: {
        ...DEFAULT_THEME.colors,
        primary: '#f472b6',
        secondary: '#60a5fa',
        accent: '#fbbf24',
        background: '#fef3f2',
        surface: '#fce7f3',
        text: '#831843',
        textMuted: '#be185d',
        headerBg: '#fef3f2',
        footerBg: '#831843',
        footerText: '#fbcfe8',
        buttonBg: '#f472b6',
        buttonText: '#ffffff',
        priceColor: '#059669',
        salePriceColor: '#dc2626',
        borderColor: '#fbcfe8',
      },
      typography: { ...DEFAULT_THEME.typography, headingFont: 'Poppins', bodyFont: 'Inter', headingWeight: 'font-extrabold' },
    },
  },
  {
    id: 'eco',
    name: 'Eco',
    nameAr: 'بيئي',
    description: 'Natural and earthy theme for organic, sustainable, and wellness brands.',
    preview: { primary: '#059669', background: '#f0fdf4' },
    theme: {
      ...DEFAULT_THEME,
      layout: 'minimal',
      colors: {
        ...DEFAULT_THEME.colors,
        primary: '#059669',
        secondary: '#0d9488',
        accent: '#84cc16',
        background: '#f0fdf4',
        surface: '#dcfce7',
        text: '#14532d',
        textMuted: '#15803d',
        headerBg: '#f0fdf4',
        footerBg: '#14532d',
        footerText: '#86efac',
        buttonBg: '#059669',
        buttonText: '#ffffff',
        priceColor: '#059669',
        salePriceColor: '#dc2626',
        borderColor: '#bbf7d0',
      },
      typography: { ...DEFAULT_THEME.typography, headingFont: 'Inter', bodyFont: 'Inter', headingWeight: 'font-semibold' },
    },
  },
];

router.get('/presets', protect, async (req, res) => {
  res.json(PRESET_THEMES.map(p => ({ id: p.id, name: p.name, nameAr: p.nameAr, description: p.description, preview: p.preview })));
});

// Apply a preset theme as the new draft
router.post('/presets/:id', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const preset = PRESET_THEMES.find(p => p.id === req.params.id);
    if (!preset) return res.status(404).json({ error: 'Preset not found' });

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    tenant.ecommerce = tenant.ecommerce || {};
    tenant.ecommerce.theme = tenant.ecommerce.theme || {};
    tenant.ecommerce.theme.draft = preset.theme;
    tenant.ecommerce.theme.draftUpdatedAt = new Date();
    await tenant.save();
    res.json({ draft: mergeDefaults(tenant.ecommerce.theme.draft), draftUpdatedAt: tenant.ecommerce.theme.draftUpdatedAt });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Upload theme image (logo, hero background, etc.)
router.post('/upload', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const tenantIdStr = req.user.tenantId.toString();
    const filename = `theme-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
    const key = `ecommerce/${tenantIdStr}/${filename}`;

    const buffer = await sharp(req.file.buffer)
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const { url: imageUrl } = await saveUploadBuffer({
      buffer,
      key,
      contentType: 'image/webp',
      publicUrlPath: `/uploads/${key}`,
    });
    res.json({ imageUrl });
  } catch (error) {
    console.error('Ecommerce theme upload error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// Helper: deep merge user config over defaults
function mergeDefaults(userConfig) {
  if (!userConfig || typeof userConfig !== 'object') return DEFAULT_THEME;
  return {
    ...DEFAULT_THEME,
    ...userConfig,
    colors: { ...DEFAULT_THEME.colors, ...(userConfig.colors || {}) },
    typography: { ...DEFAULT_THEME.typography, ...(userConfig.typography || {}) },
    header: { ...DEFAULT_THEME.header, ...(userConfig.header || {}), announcementBar: { ...DEFAULT_THEME.header.announcementBar, ...((userConfig.header || {}).announcementBar || {}) } },
    headerNav: { ...DEFAULT_THEME.headerNav, ...(userConfig.headerNav || {}) },
    footer: { ...DEFAULT_THEME.footer, ...(userConfig.footer || {}), socialLinks: { ...DEFAULT_THEME.footer.socialLinks, ...((userConfig.footer || {}).socialLinks || {}) } },
    homepage: { ...DEFAULT_THEME.homepage, ...(userConfig.homepage || {}), sections: userConfig.homepage?.sections || DEFAULT_THEME.homepage.sections },
    productPage: { ...DEFAULT_THEME.productPage, ...(userConfig.productPage || {}) },
    cart: { ...DEFAULT_THEME.cart, ...(userConfig.cart || {}) },
    mobileNav: { ...DEFAULT_THEME.mobileNav, ...(userConfig.mobileNav || {}) },
    darkMode: {
      ...DEFAULT_THEME.darkMode,
      ...(userConfig.darkMode || {}),
      colors: { ...DEFAULT_THEME.darkMode.colors, ...((userConfig.darkMode || {}).colors || {}) },
    },
  };
}

// Export theme config as a downloadable JSON file
router.get('/export', protect, async (req, res) => {
  try {
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const draft = tenant.ecommerce?.theme?.draft || DEFAULT_THEME;
    const published = tenant.ecommerce?.theme?.published || null;
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      storeName: tenant.ecommerce?.storeName || tenant.name,
      draft: mergeDefaults(draft),
      published: published ? mergeDefaults(published) : null,
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="maqder-theme-${Date.now()}.json"`);
    res.json(exportData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Import theme config from uploaded JSON file
router.post('/import', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const tenantId = getTargetTenantId(req.user, req);
    if (!tenantId) return res.status(400).json({ error: 'No tenant found.' });

    let parsed;
    try {
      parsed = JSON.parse(req.file.buffer.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Invalid JSON file' });
    }

    if (!parsed.draft && !parsed.published && !parsed.colors) {
      return res.status(400).json({ error: 'Invalid theme file — no theme data found' });
    }

    const themeData = parsed.draft || parsed;

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    tenant.ecommerce = tenant.ecommerce || {};
    tenant.ecommerce.theme = tenant.ecommerce.theme || {};
    tenant.ecommerce.theme.draft = mergeDefaults(themeData);
    tenant.ecommerce.theme.draftUpdatedAt = new Date();
    await tenant.save();

    res.json({ draft: mergeDefaults(tenant.ecommerce.theme.draft), draftUpdatedAt: tenant.ecommerce.theme.draftUpdatedAt });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
