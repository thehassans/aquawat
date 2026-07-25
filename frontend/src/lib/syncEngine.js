import { openDB } from 'idb';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'maqder_offline_db';
const DB_VERSION = 1;

/**
 * Initialize the IndexedDB for Offline-First Storage
 */
export async function initDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create store for pending sync items (e.g., invoices)
      if (!db.objectStoreNames.contains('sync_queue')) {
        const syncQueueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
        syncQueueStore.createIndex('createdAt', 'createdAt');
        syncQueueStore.createIndex('status', 'status'); // PENDING, FAILED
      }
      
      // Create store for ZATCA sequence state (ICV, PIH)
      if (!db.objectStoreNames.contains('zatca_state')) {
        db.createObjectStore('zatca_state');
      }
      
      // Create store for cached GET requests
      if (!db.objectStoreNames.contains('api_cache')) {
        db.createObjectStore('api_cache', { keyPath: 'url' });
      }

      // We can also add products/customers stores here for full offline POS capability
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: '_id' });
      }
    },
  });
}

/**
 * Add an item to the sync queue.
 * @param {string} type - e.g., 'CREATE_INVOICE'
 * @param {object} payload - The data payload (e.g., the complete signed invoice)
 */
export async function enqueueSyncItem(type, payload) {
  const db = await initDb();
  const id = uuidv4();
  const item = {
    id,
    type,
    payload,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    retryCount: 0,
    error: null
  };
  await db.put('sync_queue', item);
  return id;
}

/**
 * Retrieve the current ZATCA state (ICV, PIH)
 * If not found locally, defaults are returned.
 */
export async function getZatcaState() {
  const db = await initDb();
  let state = await db.get('zatca_state', 'current');
  if (!state) {
    state = {
      icv: 0,
      pih: 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjZTllMzEwNjI2MzRiMjEzMWE1YTMzNzRkZjRmNmQyZThlMQ==' // Base64 '0' hash
    };
  }
  return state;
}

/**
 * Update the local ZATCA state sequentially.
 * Uses a transaction to ensure no race conditions during update.
 * @param {function} updateFn - Function that receives current state and returns new state
 */
export async function updateZatcaState(updateFn) {
  const db = await initDb();
  const tx = db.transaction('zatca_state', 'readwrite');
  const store = tx.objectStore('zatca_state');
  
  let state = await store.get('current');
  if (!state) {
    state = {
      icv: 0,
      pih: 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjZTllMzEwNjI2MzRiMjEzMWE1YTMzNzRkZjRmNmQyZThlMQ=='
    };
  }
  
  const newState = updateFn(state);
  await store.put(newState, 'current');
  await tx.done;
  
  return newState;
}

/**
 * Get all pending items in the sync queue, sorted chronologically.
 */
export async function getPendingSyncItems() {
  const db = await initDb();
  const tx = db.transaction('sync_queue', 'readonly');
  const store = tx.objectStore('sync_queue');
  const index = store.index('createdAt');
  
  const allItems = await index.getAll();
  return allItems.filter(item => item.status === 'PENDING');
}

/**
 * Update the status of a sync item.
 */
export async function updateSyncItemStatus(id, updates) {
  const db = await initDb();
  const tx = db.transaction('sync_queue', 'readwrite');
  const store = tx.objectStore('sync_queue');
  
  const item = await store.get(id);
  if (item) {
    Object.assign(item, updates);
    await store.put(item);
  }
  await tx.done;
}

/**
 * Delete a successfully synced item from the queue.
 */
export async function removeSyncItem(id) {
  const db = await initDb();
  await db.delete('sync_queue', id);
}
