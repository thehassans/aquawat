import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import SystemSettings from '../models/SystemSettings.js';

const DEPRECATED_GROQ_MODELS = ['llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview', 'llama-3.2-1b-preview', 'llama-3.2-3b-preview'];
const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';

function normalizeGroqModel(model) {
  const m = String(model || '').trim();
  if (!m || DEPRECATED_GROQ_MODELS.includes(m)) return DEFAULT_GROQ_MODEL;
  return m;
}

export const getAISettings = async () => {
  const settings = await SystemSettings.findOne({ key: 'global' }).select('gemini openai grok groq').lean();
  if (settings?.groq?.model) {
    settings.groq.model = normalizeGroqModel(settings.groq.model);
  }
  return settings || {};
};

export const translateWithFallback = async ({ text, targetLanguage, _batchMode = false }) => {
  const settings = await getAISettings();
  const sourceLang = targetLanguage === 'en' ? 'Arabic' : 'English';
  const targetLangStr = targetLanguage === 'en' ? 'English' : 'Arabic';
  
  // In batch mode the caller already constructs the full prompt
  const prompt = _batchMode
    ? text
    : `Translate the following text from ${sourceLang} to ${targetLangStr}. If the text is a proper name, transliterate it appropriately. Return only the translated text without quotes or extra commentary.\n\nText:\n"""${text}"""`;

  let lastError = null;
  let attempt = 0;

  // Helper: detect if an error is a rate-limit (429) response
  const isRateLimited = (e) => e?.status === 429 || e?.response?.status === 429
    || String(e?.message || '').toLowerCase().includes('rate limit')
    || String(e?.message || '').toLowerCase().includes('quota');

  const backoff = async (ms) => new Promise(r => setTimeout(r, ms));

  // 1. Try Gemini
  if (settings?.gemini?.enabled !== false && settings?.gemini?.apiKey) {
    try {
      const client = new GoogleGenAI({ apiKey: settings.gemini.apiKey });
      const response = await client.models.generateContent({
        model: settings.gemini.model || 'gemini-2.5-flash',
        contents: prompt,
        config: { temperature: 0.1 }
      });
      if (response?.text) return response.text.trim();
    } catch (e) {
      lastError = e;
      attempt++;
      const waitMs = isRateLimited(e) ? Math.min(1000 * Math.pow(2, attempt), 10000) : 0;
      if (waitMs > 0) await backoff(waitMs);
      console.warn('[Translation] Gemini failed, falling back...', e.message);
    }
  }

  // 2. Try Grok
  if (settings?.grok?.enabled !== false && settings?.grok?.apiKey) {
    try {
      const client = new OpenAI({ apiKey: settings.grok.apiKey, baseURL: "https://api.x.ai/v1" });
      const response = await client.chat.completions.create({
        model: settings.grok.model || 'grok-2-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });
      if (response.choices?.[0]?.message?.content) return response.choices[0].message.content.trim();
    } catch (e) {
      lastError = e;
      attempt++;
      const waitMs = isRateLimited(e) ? Math.min(1000 * Math.pow(2, attempt), 10000) : 0;
      if (waitMs > 0) await backoff(waitMs);
      console.warn('[Translation] Grok failed, falling back...', e.message);
    }
  }

  // 3. Try Groq
  if (settings?.groq?.enabled !== false && settings?.groq?.apiKey) {
    try {
      const client = new OpenAI({ apiKey: settings.groq.apiKey, baseURL: "https://api.groq.com/openai/v1" });
      const response = await client.chat.completions.create({
        model: settings.groq.model || 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });
      if (response.choices?.[0]?.message?.content) return response.choices[0].message.content.trim();
    } catch (e) {
      lastError = e;
      attempt++;
      const waitMs = isRateLimited(e) ? Math.min(1000 * Math.pow(2, attempt), 10000) : 0;
      if (waitMs > 0) await backoff(waitMs);
      console.warn('[Translation] Groq failed, falling back...', e.message);
    }
  }

  // 4. Try OpenAI
  if (settings?.openai?.enabled !== false && settings?.openai?.apiKey) {
    try {
      const client = new OpenAI({ apiKey: settings.openai.apiKey });
      const response = await client.chat.completions.create({
        model: settings.openai.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });
      if (response.choices?.[0]?.message?.content) return response.choices[0].message.content.trim();
    } catch (e) {
      lastError = e;
      console.warn('[Translation] OpenAI failed...', e.message);
    }
  }

  throw lastError || new Error('No AI provider configured or all providers failed');
};

export const extractKhayyatMeasurements = async ({ base64Image, mimeType }) => {
  const settings = await getAISettings();
  let lastError = null;
  
  const systemPrompt = `You are an expert AI for a tailoring (khayyat) shop. Extract tailoring measurements from hand-written sketches or measurement sheets. Return a JSON object with a "measurements" object containing the extracted fields (e.g., length, shoulderWidth, chest, waist, hips, bottom, sleeveLength, armhole, bicep, forearm, wrist, cuffWidth, neck, expansion). All values should be numbers (centimeters) or null if not found. Also extract any additional notes into a "notes" string field. Return only valid JSON.`;

  const geminiKey = settings?.gemini?.apiKey || process.env.GEMINI_API_KEY;
  const openaiKey = settings?.openai?.apiKey || process.env.OPENAI_API_KEY;

  // 0. Try Self-Hosted GLM-OCR
  const glmOcrEnabled = settings?.glmOcr?.enabled;
  if (glmOcrEnabled) {
    try {
      const glmOcrKey = settings?.glmOcr?.apiKey || process.env.GLM_OCR_API_KEY || 'EMPTY';
      const glmOcrBaseURL = settings?.glmOcr?.baseURL || 'http://localhost:8000/v1';
      const client = new OpenAI({ apiKey: glmOcrKey, baseURL: glmOcrBaseURL });
      const response = await client.chat.completions.create({
        model: settings?.glmOcr?.model || 'glm-ocr',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
              { type: 'text', text: 'Extract tailoring measurements from this image. Return structured JSON.' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      if (response.choices?.[0]?.message?.content) {
        return JSON.parse(response.choices[0].message.content.trim());
      }
    } catch (e) {
      lastError = e;
      console.warn('[OCR] GLM-OCR failed, falling back...', e.message);
    }
  }

  // 1. Try Gemini
  if (settings?.gemini?.enabled !== false && geminiKey) {
    try {
      const client = new GoogleGenAI({ apiKey: geminiKey });
      const response = await client.models.generateContent({
        model: settings?.gemini?.model || 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [
              { text: systemPrompt + '\n\nExtract tailoring measurements from this image. Return structured JSON.' },
              { inlineData: { data: base64Image, mimeType } }
            ]
          }
        ],
        config: { temperature: 0.1, responseMimeType: 'application/json' }
      });
      if (response?.text) return JSON.parse(response.text.trim());
    } catch (e) {
      lastError = e;
      console.warn('[OCR] Gemini failed, falling back...', e.message);
    }
  }

  // 2. Try OpenAI
  if (settings?.openai?.enabled !== false && openaiKey) {
    try {
      const client = new OpenAI({ apiKey: openaiKey });
      const response = await client.chat.completions.create({
        model: settings?.openai?.model || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
              { type: 'text', text: 'Extract tailoring measurements from this image. Return structured JSON.' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      if (response.choices?.[0]?.message?.content) {
        return JSON.parse(response.choices[0].message.content.trim());
      }
    } catch (e) {
      lastError = e;
      console.warn('[OCR] OpenAI failed...', e.message);
    }
  }

  // 3. Try Grok (xAI)
  const grokKey = settings?.grok?.apiKey || process.env.GROK_API_KEY;
  if (settings?.grok?.enabled !== false && grokKey) {
    try {
      const client = new OpenAI({ apiKey: grokKey, baseURL: 'https://api.x.ai/v1' });
      const response = await client.chat.completions.create({
        model: settings?.grok?.model || 'grok-2-vision-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
              { type: 'text', text: 'Extract tailoring measurements from this image. Return structured JSON.' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      if (response.choices?.[0]?.message?.content) {
        return JSON.parse(response.choices[0].message.content.trim());
      }
    } catch (e) {
      lastError = e;
      console.warn('[OCR] Grok failed...', e.message);
    }
  }

  // 4. Try Groq
  const groqKey = settings?.groq?.apiKey || process.env.GROQ_API_KEY;
  if (settings?.groq?.enabled !== false && groqKey) {
    try {
      const client = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' });
      const response = await client.chat.completions.create({
        model: settings?.groq?.model || 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
              { type: 'text', text: 'Extract tailoring measurements from this image. Return structured JSON.' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      if (response.choices?.[0]?.message?.content) {
        return JSON.parse(response.choices[0].message.content.trim());
      }
    } catch (e) {
      lastError = e;
      console.warn('[OCR] Groq failed...', e.message);
    }
  }

  throw lastError || new Error('No AI provider configured for OCR or all providers failed. Please set your API key in System Settings.');
};

export const extractRestaurantMenu = async ({ base64Image, mimeType }) => {
  const settings = await getAISettings();
  let lastError = null;
  
  const systemPrompt = `You are an expert AI for a restaurant. Extract the food items from the provided menu image. Return a JSON object with an "items" array containing the extracted fields: nameEn (string, required), nameAr (string, optional), descriptionEn (string, optional), descriptionAr (string, optional), category (string, required, e.g., 'Starters', 'Main Course', 'Drinks'), sellingPrice (number, required). Return only valid JSON.`;

  const geminiKey = settings?.gemini?.apiKey || process.env.GEMINI_API_KEY;
  const openaiKey = settings?.openai?.apiKey || process.env.OPENAI_API_KEY;

  // 0. Try Self-Hosted GLM-OCR
  const glmOcrEnabled = settings?.glmOcr?.enabled;
  if (glmOcrEnabled) {
    try {
      const glmOcrKey = settings?.glmOcr?.apiKey || process.env.GLM_OCR_API_KEY || 'EMPTY';
      const glmOcrBaseURL = settings?.glmOcr?.baseURL || 'http://localhost:8000/v1';
      const client = new OpenAI({ apiKey: glmOcrKey, baseURL: glmOcrBaseURL });
      const response = await client.chat.completions.create({
        model: settings?.glmOcr?.model || 'glm-ocr',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
              { type: 'text', text: 'Extract restaurant menu items from this image. Return structured JSON.' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      if (response.choices?.[0]?.message?.content) {
        return JSON.parse(response.choices[0].message.content.trim());
      }
    } catch (e) {
      lastError = e;
      console.warn('[OCR] GLM-OCR failed, falling back...', e.message);
    }
  }

  // 1. Try Gemini
  if (settings?.gemini?.enabled !== false && geminiKey) {
    try {
      const client = new GoogleGenAI({ apiKey: geminiKey });
      const response = await client.models.generateContent({
        model: settings?.gemini?.model || 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [
              { text: systemPrompt + '\n\nExtract restaurant menu items from this image. Return structured JSON.' },
              { inlineData: { data: base64Image, mimeType } }
            ]
          }
        ],
        config: { temperature: 0.1, responseMimeType: 'application/json' }
      });
      if (response?.text) return JSON.parse(response.text.trim());
    } catch (e) {
      lastError = e;
      console.warn('[OCR] Gemini failed, falling back...', e.message);
    }
  }

  // 2. Try OpenAI
  if (settings?.openai?.enabled !== false && openaiKey) {
    try {
      const client = new OpenAI({ apiKey: openaiKey });
      const response = await client.chat.completions.create({
        model: settings?.openai?.model || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
              { type: 'text', text: 'Extract restaurant menu items from this image. Return structured JSON.' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      if (response.choices?.[0]?.message?.content) {
        return JSON.parse(response.choices[0].message.content.trim());
      }
    } catch (e) {
      lastError = e;
      console.warn('[OCR] OpenAI failed...', e.message);
    }
  }

  // 3. Try Grok (xAI)
  const grokKey = settings?.grok?.apiKey || process.env.GROK_API_KEY;
  if (settings?.grok?.enabled !== false && grokKey) {
    try {
      const client = new OpenAI({ apiKey: grokKey, baseURL: 'https://api.x.ai/v1' });
      const response = await client.chat.completions.create({
        model: settings?.grok?.model || 'grok-2-vision-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
              { type: 'text', text: 'Extract restaurant menu items from this image. Return structured JSON.' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      if (response.choices?.[0]?.message?.content) {
        return JSON.parse(response.choices[0].message.content.trim());
      }
    } catch (e) {
      lastError = e;
      console.warn('[OCR] Grok failed...', e.message);
    }
  }

  // 4. Try Groq
  const groqKey = settings?.groq?.apiKey || process.env.GROQ_API_KEY;
  if (settings?.groq?.enabled !== false && groqKey) {
    try {
      const client = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' });
      const response = await client.chat.completions.create({
        model: settings?.groq?.model || 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
              { type: 'text', text: 'Extract restaurant menu items from this image. Return structured JSON.' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      if (response.choices?.[0]?.message?.content) {
        return JSON.parse(response.choices[0].message.content.trim());
      }
    } catch (e) {
      lastError = e;
      console.warn('[OCR] Groq failed...', e.message);
    }
  }

  throw lastError || new Error('No AI provider configured for OCR or all providers failed. Please set your API key in System Settings.');
};

export const extractSmartInvoice = async ({ base64Image, mimeType }) => {
  const settings = await getAISettings();
  let lastError = null;
  
  const systemPrompt = `You are an OCR expert. Extract detailed invoice data from the image into strict JSON matching this structure exactly. Be sure to extract every single line item and its VAT details.
CRITICAL: You must extract text in both Arabic and English. If the original text is only in Arabic, you MUST provide the English translation for "name" fields. If the original is only in English, you MUST provide the Arabic translation for "nameAr" fields. This applies to supplier, buyer, and ALL line items.
{
  "supplier": { "name": "...", "nameAr": "...", "vatNumber": "...", "address": { "city": "..." } },
  "buyer": { "name": "...", "nameAr": "...", "vatNumber": "...", "address": { "city": "..." } },
  "lineItems": [ { "name": "...", "nameAr": "...", "quantity": 1, "unitPrice": 100, "taxRate": 15, "taxAmount": 15, "lineTotal": 100, "lineTotalWithTax": 115 } ],
  "issueDate": "YYYY-MM-DD",
  "notes": "...",
  "totalAmount": 100,
  "totalTax": 15,
  "grandTotal": 115
}`;

  const geminiKey = settings?.gemini?.apiKey || process.env.GEMINI_API_KEY;
  const openaiKey = settings?.openai?.apiKey || process.env.OPENAI_API_KEY;

  // 0. Try Self-Hosted GLM-OCR
  const glmOcrEnabled = settings?.glmOcr?.enabled;
  if (glmOcrEnabled) {
    try {
      const glmOcrKey = settings?.glmOcr?.apiKey || process.env.GLM_OCR_API_KEY || 'EMPTY';
      const glmOcrBaseURL = settings?.glmOcr?.baseURL || 'http://localhost:8000/v1';
      const client = new OpenAI({ apiKey: glmOcrKey, baseURL: glmOcrBaseURL });
      const response = await client.chat.completions.create({
        model: settings?.glmOcr?.model || 'glm-ocr',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
              { type: 'text', text: 'Extract invoice data from this image. Return structured JSON.' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      if (response.choices?.[0]?.message?.content) {
        return JSON.parse(response.choices[0].message.content.trim());
      }
    } catch (e) {
      lastError = e;
      console.warn('[OCR] GLM-OCR failed, falling back...', e.message);
    }
  }

  // 1. Try Gemini
  if (settings?.gemini?.enabled !== false && geminiKey) {
    try {
      const client = new GoogleGenAI({ apiKey: geminiKey });
      const response = await client.models.generateContent({
        model: settings?.gemini?.model || 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [
              { text: systemPrompt + '\n\nExtract invoice data from this image. Return structured JSON.' },
              { inlineData: { data: base64Image, mimeType } }
            ]
          }
        ],
        config: { temperature: 0.1, responseMimeType: 'application/json' }
      });
      if (response?.text) return JSON.parse(response.text.trim());
    } catch (e) {
      lastError = e;
      console.warn('[OCR] Gemini failed, falling back...', e.message);
    }
  }

  // 2. Try OpenAI
  if (settings?.openai?.enabled !== false && openaiKey) {
    try {
      const client = new OpenAI({ apiKey: openaiKey });
      const response = await client.chat.completions.create({
        model: settings?.openai?.model || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
              { type: 'text', text: 'Extract invoice data from this image. Return structured JSON.' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      if (response.choices?.[0]?.message?.content) {
        return JSON.parse(response.choices[0].message.content.trim());
      }
    } catch (e) {
      lastError = e;
      console.warn('[OCR] OpenAI failed...', e.message);
    }
  }

  throw lastError || new Error('No AI provider configured for OCR or all providers failed. Please set your API key in System Settings.');
};
