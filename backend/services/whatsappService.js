import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import { existsSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import os from 'os';
import { WhatsAppContact, WhatsAppMessage } from '../models/WhatsApp.js';

class WhatsAppService {
  constructor() {
    this.clients = new Map();
    this.qrCodes = new Map();
    this.status = new Map();
  }

  _cleanSession(tenantId) {
    const sessionDir = path.resolve(`.wwebjs_auth/session-tenant-${tenantId}`);
    if (existsSync(sessionDir)) {
      try { rmSync(sessionDir, { recursive: true, force: true }); } catch (_) {}
    }
  }

  get _chromePath() {
    return this._findChrome();
  }

  _findChrome() {
    // 1. Explicit env var (set in Plesk custom environment variables)
    const envPath = process.env.CHROME_EXECUTABLE_PATH;
    if (envPath && existsSync(envPath)) {
      console.log('[WhatsApp] Chrome from env var:', envPath);
      return envPath;
    }

    // 2. Linux system paths
    const linuxPaths = [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
    ];
    for (const p of linuxPaths) {
      if (existsSync(p)) {
        console.log('[WhatsApp] Chrome found at:', p);
        return p;
      }
    }

    // 3. Windows: scan puppeteer cache and standard paths
    if (os.platform() === 'win32') {
      const winPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
      ];
      for (const p of winPaths) {
        if (existsSync(p)) {
          console.log('[WhatsApp] Chrome found at standard path:', p);
          return p;
        }
      }
      const cacheDir = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
      if (existsSync(cacheDir)) {
        try {
          const out = execSync(`dir "${cacheDir}" /b /s /a-d chrome.exe 2>nul`, { encoding: 'utf8', timeout: 5000 });
          const found = out.trim().split('\n').map(l => l.trim()).filter(l => l && existsSync(l))[0];
          if (found) { console.log('[WhatsApp] Chrome via scan:', found); return found; }
        } catch (_) {}
      }
    }

    // 4. Try which command (Linux)
    try {
      const found = execSync('which google-chrome-stable 2>/dev/null || which chromium-browser 2>/dev/null || echo ""', { encoding: 'utf8', timeout: 3000 }).trim();
      if (found && existsSync(found)) { console.log('[WhatsApp] Chrome via which:', found); return found; }
    } catch (_) {}

    console.warn('[WhatsApp] No Chrome found. Set CHROME_EXECUTABLE_PATH env var in Plesk.');
    return null;
  }

  getStatus(tenantId) {
    tenantId = String(tenantId);
    return {
      status: this.status.get(tenantId)?.state || 'DISCONNECTED',
      qrCode: this.qrCodes.get(tenantId) || null,
      error: this.status.get(tenantId)?.error || null,
    };
  }

  async initClient(tenantId, force = false) {
    tenantId = String(tenantId);

    // When API is configured to use an external WA worker, refuse Chromium here.
    if (process.env.WHATSAPP_WORKER_EXTERNAL === '1' && process.env.WHATSAPP_WORKER !== '1') {
      const errMsg =
        'WhatsApp Chromium init is disabled on the API (WHATSAPP_WORKER_EXTERNAL=1). ' +
        'Run the dedicated worker: node workers/whatsappWorker.js (or npm run worker:whatsapp) with WHATSAPP_WORKER=1.';
      console.error('[WhatsApp]', errMsg);
      this.status.set(tenantId, { state: 'DISCONNECTED', error: errMsg });
      return this.getStatus(tenantId);
    }

    const existing = this.clients.get(tenantId);
    const existingState = this.status.get(tenantId)?.state;

    if (existing && !force) {
      if (existingState === 'READY' || existingState === 'CONNECTED') {
        return this.getStatus(tenantId);
      }
    }

    // Clean up any existing stuck client before restarting
    if (existing) {
      try { await existing.destroy(); } catch (_) {}
      this.clients.delete(tenantId);
      this.qrCodes.delete(tenantId);
    }
    this._cleanSession(tenantId);

    this.status.set(tenantId, { state: 'INITIALIZING', error: null });

    const chromePath = this._findChrome();
    if (!chromePath) {
      const errMsg = 'No Chrome/Chromium found. Set CHROME_EXECUTABLE_PATH=/usr/bin/google-chrome-stable in Plesk environment variables.';
      console.error('[WhatsApp]', errMsg);
      this.status.set(tenantId, { state: 'DISCONNECTED', error: errMsg });
      return this.getStatus(tenantId);
    }

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: `tenant-${tenantId}` }),
      puppeteer: {
        headless: true,
        executablePath: chromePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--single-process',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
        ],
      },
    });

    this.clients.set(tenantId, client);

    client.on('qr', async (qr) => {
      console.log(`[WhatsApp] QR received for tenant ${tenantId}`);
      this.status.set(tenantId, { state: 'QR_READY', error: null });
      try {
        const qrDataUrl = await qrcode.toDataURL(qr);
        this.qrCodes.set(tenantId, qrDataUrl);
      } catch (err) {
        console.error(`[WhatsApp] QR generation error:`, err);
      }
    });

    client.on('ready', async () => {
      console.log(`[WhatsApp] Ready for tenant ${tenantId}`);
      this.status.set(tenantId, { state: 'READY', error: null });
      this.qrCodes.delete(tenantId);
      // Auto-sync contacts and groups in background
      try { await this.syncContacts(tenantId); } catch (e) { console.error(`[WhatsApp] Auto-sync error for tenant ${tenantId}:`, e.message); }
    });

    client.on('authenticated', () => {
      console.log(`[WhatsApp] Authenticated for tenant ${tenantId}`);
      this.status.set(tenantId, { state: 'CONNECTED', error: null });
    });

    client.on('auth_failure', (msg) => {
      console.error(`[WhatsApp] Auth failure:`, msg);
      this.status.set(tenantId, { state: 'DISCONNECTED', error: String(msg) });
      this.qrCodes.delete(tenantId);
      this.clients.delete(tenantId);
    });

    client.on('disconnected', (reason) => {
      console.log(`[WhatsApp] Disconnected:`, reason);
      this.status.set(tenantId, { state: 'DISCONNECTED', error: String(reason) });
      this.qrCodes.delete(tenantId);
      this.clients.delete(tenantId);
    });

    // Capture messages sent/received from any device
    client.on('message_create', async (msg) => {
      try {
        // Skip status broadcast messages
        if (msg.from === 'status@broadcast') return;

        const chatId = msg.fromMe ? msg.to : msg.from;
        const isGroup = String(chatId).endsWith('@g.us');
        const msgId = msg.id?._serialized;

        // Find or create contact
        let contact;
        const contactQuery = isGroup
          ? { tenantId, groupId: chatId }
          : { tenantId, phoneNumber: this._cleanPhoneNumber(chatId) };

        contact = await WhatsAppContact.findOne(contactQuery);
        if (!contact) {
          const newContactData = {
            tenantId,
            source: 'webhook',
            isGroup,
            name: msg._data?.notifyName || this._cleanPhoneNumber(chatId)
          };
          if (isGroup) {
            newContactData.groupId = chatId;
          } else {
            const phone = this._cleanPhoneNumber(chatId);
            newContactData.phoneNumber = phone;
            newContactData.formattedPhone = this._formatPhone(phone);
          }
          contact = await WhatsAppContact.create(newContactData);
        }

        // Avoid duplicate saves (e.g. messages already saved by our own send routes)
        const existing = await WhatsAppMessage.findOne({ tenantId, waMessageId: msgId });
        if (existing) return;

        // Map whatsapp-web.js types to schema enum
        const typeMap = {
          chat: 'text',
          ptt: 'audio',
          vcard: 'contact'
        };
        const messageType = typeMap[msg.type] || msg.type || 'text';

        await WhatsAppMessage.create({
          tenantId,
          contactId: contact._id,
          waMessageId: msgId,
          direction: msg.fromMe ? 'outbound' : 'inbound',
          type: messageType,
          text: msg.body || null,
          timestamp: new Date(msg.timestamp * 1000),
          status: msg.fromMe ? 'sent' : 'delivered'
        });

        // Update contact
        await WhatsAppContact.findByIdAndUpdate(contact._id, {
          lastMessageAt: new Date(),
          ...(msg.fromMe ? {} : { $inc: { unreadCount: 1 } }),
          $inc: { totalMessages: 1 }
        });
      } catch (e) {
        console.error(`[WhatsApp] message_create handler error for tenant ${tenantId}:`, e.message);
      }
    });

    // Initialize with retry for shared-hosting crashes
    (async () => {
      let attempts = 0;
      const maxAttempts = 3;
      while (attempts < maxAttempts) {
        attempts++;
        try {
          await client.initialize();
          break; // success
        } catch (err) {
          const msg = err?.stack || err?.message || String(err);
          console.error(`[WhatsApp] Init attempt ${attempts} failed for tenant ${tenantId}:`, msg);
          if (String(msg).includes('Execution context was destroyed') && attempts < maxAttempts) {
            console.warn(`[WhatsApp] Retrying initialization in 3s...`);
            await new Promise(r => setTimeout(r, 3000));
          } else {
            this.status.set(tenantId, { state: 'DISCONNECTED', error: msg });
            this.clients.delete(tenantId);
            this._cleanSession(tenantId);
            break;
          }
        }
      }
    })();

    // Timeout: if still INITIALIZING after 60s, kill it
    setTimeout(() => {
      if (this.status.get(tenantId)?.state === 'INITIALIZING') {
        console.error(`[WhatsApp] Init timeout for tenant ${tenantId}`);
        const client = this.clients.get(tenantId);
        if (client) { try { client.destroy(); } catch (_) {} }
        this.clients.delete(tenantId);
        this.qrCodes.delete(tenantId);
        this._cleanSession(tenantId);
        this.status.set(tenantId, { state: 'DISCONNECTED', error: 'Initialization timed out. Please try again.' });
      }
    }, 60000);

    return this.getStatus(tenantId);
  }

  _cleanPhoneNumber(raw) {
    if (!raw) return '';
    // Strip any @suffix like @c.us, @g.us, @lid, etc.
    const withoutSuffix = String(raw).split('@')[0];
    // Keep only digits
    const digits = withoutSuffix.replace(/\D/g, '');
    return digits;
  }

  _formatPhone(digits) {
    if (!digits || digits.length < 7) return '';
    // Only add + if it looks like a real phone number (not a short/internal ID)
    return `+${digits}`;
  }

  async logout(tenantId) {
    tenantId = String(tenantId);
    const client = this.clients.get(tenantId);
    if (client) {
      try { await client.logout(); } catch (_) {}
      try { await client.destroy(); } catch (_) {}
      this.clients.delete(tenantId);
    }
    this._cleanSession(tenantId);
    this.qrCodes.delete(tenantId);
    this.status.set(tenantId, { state: 'DISCONNECTED', error: null });
  }

  async sendPdf(tenantId, phoneNumber, pdfBuffer, fileName = 'Invoice.pdf', caption = '') {
    tenantId = String(tenantId);
    const client = this.clients.get(tenantId);
    if (!client || this.status.get(tenantId)?.state !== 'READY') {
      throw new Error('WhatsApp client is not ready. Please connect first.');
    }
    let phone = phoneNumber.replace(/\D/g, '');
    if (!phone.endsWith('@c.us')) phone = `${phone}@c.us`;
    const media = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), fileName);
    return await client.sendMessage(phone, media, { caption });
  }

  async sendText(tenantId, phoneNumber, text) {
    tenantId = String(tenantId);
    const client = this.clients.get(tenantId);
    if (!client || this.status.get(tenantId)?.state !== 'READY') {
      throw new Error('WhatsApp client is not ready. Please connect first.');
    }
    let phone = phoneNumber.replace(/\D/g, '');
    if (!phone.endsWith('@c.us')) phone = `${phone}@c.us`;
    return await client.sendMessage(phone, text);
  }

  async syncContacts(tenantId) {
    tenantId = String(tenantId);
    const client = this.clients.get(tenantId);
    if (!client || this.status.get(tenantId)?.state !== 'READY') {
      throw new Error('WhatsApp client is not ready');
    }

    let individuals = 0;
    let groups = 0;

    // 1. Sync individual contacts
    try {
      const contacts = await client.getContacts();
      const validContacts = contacts.filter(c => c.isWAContact && !c.id._serialized.endsWith('@g.us'));
      for (const c of validContacts) {
        const rawId = c.id?._serialized || c.number || '';
        const cleanNumber = this._cleanPhoneNumber(rawId);
        if (!cleanNumber) continue;
        await WhatsAppContact.findOneAndUpdate(
          { tenantId, phoneNumber: cleanNumber },
          {
            tenantId,
            phoneNumber: cleanNumber,
            formattedPhone: this._formatPhone(cleanNumber),
            name: c.name || c.pushname || cleanNumber,
            profileName: c.pushname || null,
            source: 'sync',
            isGroup: false,
            groupId: null
          },
          { upsert: true, new: true }
        );
        individuals++;
      }
    } catch (e) {
      console.error(`[WhatsApp] Contact sync error for tenant ${tenantId}:`, e.message);
    }

    // 2. Sync groups
    try {
      const chats = await client.getChats();
      const groupChats = chats.filter(c => c.isGroup);
      for (const g of groupChats) {
        const gid = g.id._serialized;
        let participantCount = null;
        try {
          if (g.groupMetadata && g.groupMetadata.participants) {
            participantCount = g.groupMetadata.participants.length;
          }
        } catch (_) {}
        await WhatsAppContact.findOneAndUpdate(
          { tenantId, groupId: gid },
          {
            tenantId,
            phoneNumber: null,
            formattedPhone: null,
            name: g.name || gid,
            profileName: null,
            source: 'sync',
            isGroup: true,
            groupId: gid,
            groupDescription: g.groupMetadata?.desc || null,
            participantCount: participantCount,
            groupOwner: g.groupMetadata?.owner?._serialized || null
          },
          { upsert: true, new: true }
        );
        groups++;
      }
    } catch (e) {
      console.error(`[WhatsApp] Group sync error for tenant ${tenantId}:`, e.message);
    }

    console.log(`[WhatsApp] Synced ${individuals} contacts and ${groups} groups for tenant ${tenantId}`);
    return { individuals, groups };
  }
}

export default new WhatsAppService();
