import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import Product from '../models/Product.js';
import Invoice from '../models/Invoice.js';
import { protect, tenantFilter, checkPermission } from '../middleware/auth.js';
import { translateWithFallback, extractKhayyatMeasurements, extractRestaurantMenu, extractSmartInvoice } from '../utils/aiService.js';
import { autoTranslateText } from '../utils/builtInTranslator.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(protect);
router.use(tenantFilter);

// OpenAI is optional - AI features will be disabled if key not provided
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const checkAI = (req, res, next) => {
  if (!openai) {
    return res.status(503).json({ error: 'AI features disabled - OPENAI_API_KEY not configured' });
  }
  next();
};

// @route   POST /api/ai/extract-document
router.post('/extract-document', checkAI, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document uploaded' });
    }
    
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert document extractor for Saudi Arabian business documents. Extract structured data from invoices, receipts, employee documents (Iqama, passport), and other business documents. Return JSON with relevant fields. For invoices, extract: vendor name, VAT number, date, line items (description, quantity, unit price, VAT), totals. For employee documents, extract: name (English and Arabic if present), document number, issue date, expiry date, nationality.`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Extract all relevant data from this ${req.body.documentType || 'document'}. Return structured JSON.` },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
          ]
        }
      ],
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });
    
    const extractedData = JSON.parse(response.choices[0].message.content);
    
    res.json({
      success: true,
      documentType: req.body.documentType,
      extractedData,
      confidence: response.choices[0].finish_reason === 'stop' ? 'high' : 'medium'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/ai/extract-smart-invoice
router.post('/extract-smart-invoice', upload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No media uploaded' });
    }
    
    const mimeType = req.file.mimetype;
    
    if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
      const base64Image = req.file.buffer.toString('base64');
      const extractedData = await extractSmartInvoice({ base64Image, mimeType });
      
      res.json({
        success: true,
        extractedData
      });
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Please use image or PDF.' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/ai/khayyat-ocr
router.post('/khayyat-ocr', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;
    
    const extractedData = await extractKhayyatMeasurements({ base64Image, mimeType });
    
    res.json({
      success: true,
      ...extractedData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/ai/restaurant-menu-ocr
router.post('/restaurant-menu-ocr', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;
    
    const extractedData = await extractRestaurantMenu({ base64Image, mimeType });
    
    res.json({
      success: true,
      ...extractedData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/translate', async (req, res) => {
  try {
    const { text, sourceLang = 'en', targetLang = 'ar' } = req.body || {};
    const trimmed = String(text || '').trim();

    if (!trimmed) {
      return res.status(400).json({ error: 'Text is required' });
    }
    if (trimmed.length > 1000) {
      return res.status(400).json({ error: 'Text is too long (max 1000 chars)' });
    }

    // 1. Built-in instant translator (0ms latency, zero API limit)
    const builtInResult = autoTranslateText(trimmed, sourceLang, targetLang);
    if (builtInResult && builtInResult !== trimmed) {
      return res.json({
        success: true,
        translatedText: builtInResult,
        source: 'built-in'
      });
    }

    // 2. Optional fallback to LLM if text is complex prose
    try {
      const translatedText = await translateWithFallback({
        text: trimmed,
        targetLanguage: targetLang
      });

      if (translatedText) {
        return res.json({
          success: true,
          translatedText,
          source: 'ai-fallback'
        });
      }
    } catch (_) {
      // Fallback failed, use built-in translation result
    }

    res.json({
      success: true,
      translatedText: builtInResult || trimmed,
      source: 'built-in'
    });
  } catch (error) {
    const apiError = error.response?.data?.error?.message || error.response?.data?.error || error.message;
    res.status(500).json({ error: apiError });
  }
});

// @route   POST /api/ai/predict-inventory
router.post('/predict-inventory', checkAI, checkPermission('inventory', 'read'), async (req, res) => {
  try {
    const { productId } = req.body;
    
    // Get product and its sales history
    const product = await Product.findOne({ _id: productId, ...req.tenantFilter });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Get invoice line items for this product (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const salesData = await Invoice.aggregate([
      {
        $match: {
          tenantId: req.user.tenantId,
          issueDate: { $gte: twelveMonthsAgo },
          status: { $in: ['approved', 'sent', 'paid'] }
        }
      },
      { $unwind: '$lineItems' },
      { $match: { 'lineItems.productId': product._id } },
      {
        $group: {
          _id: { year: { $year: '$issueDate' }, month: { $month: '$issueDate' } },
          totalQuantity: { $sum: '$lineItems.quantity' },
          totalRevenue: { $sum: '$lineItems.lineTotalWithTax' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    
    if (salesData.length < 3) {
      return res.json({
        success: true,
        prediction: null,
        message: 'Insufficient sales history for prediction (minimum 3 months required)'
      });
    }
    
    // Use OpenAI for prediction
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an inventory demand forecasting AI. Analyze sales data and predict future demand. Return JSON with nextMonth, nextQuarter predictions and confidence level (0-1).'
        },
        {
          role: 'user',
          content: `Product: ${product.nameEn}
Current Stock: ${product.totalStock}
Reorder Point: ${product.stocks[0]?.reorderPoint || 10}
Historical Sales (monthly): ${JSON.stringify(salesData)}

Predict demand for next month and next quarter. Consider seasonality and trends.`
        }
      ],
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });
    
    const prediction = JSON.parse(response.choices[0].message.content);
    
    // Update product with prediction
    product.predictedDemand = {
      nextMonth: prediction.nextMonth,
      nextQuarter: prediction.nextQuarter,
      confidence: prediction.confidence,
      lastCalculated: new Date()
    };
    await product.save();
    
    res.json({
      success: true,
      product: { _id: product._id, nameEn: product.nameEn, sku: product.sku },
      currentStock: product.totalStock,
      prediction,
      recommendation: prediction.nextMonth > product.totalStock 
        ? `Reorder recommended: Current stock (${product.totalStock}) is below predicted demand (${prediction.nextMonth})`
        : 'Stock levels adequate for predicted demand'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/ai/analyze-expenses
router.post('/analyze-expenses', checkAI, checkPermission('invoicing', 'read'), async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    const invoices = await Invoice.find({
      ...req.tenantFilter,
      issueDate: {
        $gte: new Date(startDate || Date.now() - 90 * 24 * 60 * 60 * 1000),
        $lte: new Date(endDate || Date.now())
      }
    }).select('lineItems grandTotal totalTax issueDate buyer');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a financial analyst AI. Analyze invoice data and provide insights on spending patterns, tax efficiency, and cost-saving recommendations. Return JSON with insights array and recommendations array.'
        },
        {
          role: 'user',
          content: `Analyze these invoices and provide business insights:\n${JSON.stringify(invoices.slice(0, 50))}`
        }
      ],
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });
    
    const analysis = JSON.parse(response.choices[0].message.content);
    
    res.json({
      success: true,
      invoiceCount: invoices.length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.grandTotal, 0),
      totalTax: invoices.reduce((sum, inv) => sum + inv.totalTax, 0),
      analysis
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/ai/generate-description
router.post('/generate-description', checkAI, checkPermission('inventory', 'update'), async (req, res) => {
  try {
    const { productName, category, features } = req.body;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Generate product descriptions for an ERP system. Provide both English and Arabic descriptions. Return JSON with descriptionEn and descriptionAr fields.'
        },
        {
          role: 'user',
          content: `Generate a professional product description for:
Product: ${productName}
Category: ${category}
Features: ${features || 'N/A'}

Provide description in both English and Arabic.`
        }
      ],
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });
    
    const descriptions = JSON.parse(response.choices[0].message.content);
    
    res.json({
      success: true,
      ...descriptions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
