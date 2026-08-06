import { openDB } from 'idb';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'maqder_offline_db';
const DB_VERSION = 1;

/**
 * Initialize the IndexedDB for Offline-First Storage with graceful fallback
 */
export async function initDb() {
  try {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return null;
    }
    return await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sync_queue')) {
          const syncQueueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          syncQueueStore.createIndex('createdAt', 'createdAt');
          syncQueueStore.createIndex('status', 'status');
        }
        if (!db.objectStoreNames.contains('zatca_state')) {
          db.createObjectStore('zatca_state');
        }
        if (!db.objectStoreNames.contains('api_cache')) {
          db.createObjectStore('api_cache', { keyPath: 'url' });
        }
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: '_id' });
        }
      },
    });
  } catch (err) {
    console.warn('[SyncEngine] IndexedDB initialization bypassed:', err);
    return null;
  }
}

/**
 * Add an item to the sync queue.
 */
export async function enqueueSyncItem(type, payload) {
  const id = uuidv4();
  try {
    const db = await initDb();
    if (!db) return id;
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
  } catch (err) {
    console.warn('[SyncEngine] enqueueSyncItem failed:', err);
  }
  return id;
}

/**
 * Retrieve the current ZATCA state (ICV, PIH)
 */
export async function getZatcaState() {
  const defaultState = {
    icv: 0,
    pih: 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjZTllMzEwNjI2MzRiMjEzMWE1YTMzNzRkZjRmNmQyZThlMQ=='
  };
  try {
    const db = await initDb();
    if (!db) return defaultState;
    let state = await db.get('zatca_state', 'current');
    return state || defaultState;
  } catch {
    return defaultState;
  }
}

/**
 * Update the local ZATCA state sequentially.
 */
export async function updateZatcaState(updateFn) {
  const defaultState = {
    icv: 0,
    pih: 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjZTllMzEwNjI2MzRiMjEzMWE1YTMzNzRkZjRmNmQyZThlMQ=='
  };
  try {
    const db = await initDb();
    if (!db) return updateFn(defaultState);
    const tx = db.transaction('zatca_state', 'readwrite');
    const store = tx.objectStore('zatca_state');
    
    let state = await store.get('current');
    if (!state) {
      state = defaultState;
    }
    
    const newState = updateFn(state);
    await store.put(newState, 'current');
    await tx.done;
    return newState;
  } catch (err) {
    console.warn('[SyncEngine] updateZatcaState warning:', err);
    return updateFn(defaultState);
  }
}

/**
 * Get all pending items in the sync queue, sorted chronologically.
 */
export async function getPendingSyncItems() {
  try {
    const db = await initDb();
    if (!db) return [];
    const tx = db.transaction('sync_queue', 'readonly');
    const store = tx.objectStore('sync_queue');
    const index = store.index('createdAt');
    
    const allItems = await index.getAll();
    return (allItems || []).filter(item => item && item.status === 'PENDING');
  } catch (err) {
    console.warn('[SyncEngine] getPendingSyncItems warning:', err);
    return [];
  }
}

/**
 * Update the status of a sync item.
 */
export async function updateSyncItemStatus(id, updates) {
  try {
    const db = await initDb();
    if (!db) return;
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    
    const item = await store.get(id);
    if (item) {
      Object.assign(item, updates);
      await store.put(item);
    }
    await tx.done;
  } catch (err) {
    console.warn('[SyncEngine] updateSyncItemStatus warning:', err);
  }
}

/**
 * Delete a successfully synced item from the queue.
 */
export async function removeSyncItem(id) {
  try {
    const db = await initDb();
    if (!db) return;
    await db.delete('sync_queue', id);
  } catch (err) {
    console.warn('[SyncEngine] removeSyncItem warning:', err);
  }
}
