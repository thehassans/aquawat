import { openDB } from 'idb';

const DB_NAME = 'maqder_bakala_pos';
const DB_VERSION = 2;

export const initBakalaDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains('products_cache')) {
        db.createObjectStore('products_cache', { keyPath: 'primaryBarcode' });
      }
      if (!db.objectStoreNames.contains('offline_invoices')) {
        const store = db.createObjectStore('offline_invoices', { keyPath: 'offlineId' });
        store.createIndex('timestamp', 'timestamp');
      }
      if (!db.objectStoreNames.contains('pending_daftar_charges')) {
        const store = db.createObjectStore('pending_daftar_charges', { keyPath: 'offlineId' });
        store.createIndex('timestamp', 'timestamp');
      }
      if (oldVersion < 2 && !db.objectStoreNames.contains('pending_products')) {
        const store = db.createObjectStore('pending_products', { keyPath: 'pendingId' });
        store.createIndex('timestamp', 'timestamp');
      }
    },
  });
};

export const saveOfflineInvoice = async (invoice) => {
  const db = await initBakalaDB();
  await db.put('offline_invoices', {
    ...invoice,
    timestamp: Date.now()
  });
};

export const getOfflineInvoices = async () => {
  const db = await initBakalaDB();
  return db.getAllFromIndex('offline_invoices', 'timestamp');
};

export const removeOfflineInvoice = async (offlineId) => {
  const db = await initBakalaDB();
  await db.delete('offline_invoices', offlineId);
};

export const saveProductsCache = async (products) => {
  const db = await initBakalaDB();
  const tx = db.transaction('products_cache', 'readwrite');
  const valid = (products || []).filter((product) => product && (product.primaryBarcode || product._id));
  await Promise.all([
    ...valid.map((product) => tx.store.put({
      ...product,
      primaryBarcode: String(product.primaryBarcode || product._id),
    })),
    tx.done,
  ]);
};

export const getProductByBarcode = async (barcode) => {
  const db = await initBakalaDB();
  return db.get('products_cache', barcode);
};

export const getAllProducts = async () => {
  const db = await initBakalaDB();
  return db.getAll('products_cache');
};

// ─── Pending Products (offline creation) ───

export const savePendingProduct = async (product) => {
  const db = await initBakalaDB();
  await db.put('pending_products', {
    ...product,
    timestamp: Date.now(),
  });
};

export const getPendingProducts = async () => {
  const db = await initBakalaDB();
  return db.getAllFromIndex('pending_products', 'timestamp');
};

export const removePendingProduct = async (pendingId) => {
  const db = await initBakalaDB();
  await db.delete('pending_products', pendingId);
};

export const getPendingProductsCount = async () => {
  const db = await initBakalaDB();
  return db.count('pending_products');
};

// Check if a barcode already exists in cache or pending products
export const checkBarcodeExistsOffline = async (barcode) => {
  const db = await initBakalaDB();
  const inCache = await db.get('products_cache', barcode);
  if (inCache) return { exists: true, source: 'cache', product: inCache };
  const pending = await db.getAll('pending_products');
  const inPending = pending.find((p) => p.primaryBarcode === barcode);
  if (inPending) return { exists: true, source: 'pending', product: inPending };
  return { exists: false };
};

// Add a product to the local cache (used after sync confirms creation)
export const addProductToCache = async (product) => {
  const db = await initBakalaDB();
  await db.put('products_cache', product);
};
