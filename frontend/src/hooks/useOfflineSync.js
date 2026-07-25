import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setOnlineStatus, setSyncStatus, setPendingItemsCount } from '../store/slices/networkSlice';
import { getPendingSyncItems, updateSyncItemStatus, removeSyncItem } from '../lib/syncEngine';
import api from '../lib/api';

export function useOfflineSync() {
  const dispatch = useDispatch();
  const { isOnline, syncStatus } = useSelector((state) => state.network);

  // Monitor Network Status
  useEffect(() => {
    const handleOnline = () => dispatch(setOnlineStatus(true));
    const handleOffline = () => dispatch(setOnlineStatus(false));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    dispatch(setOnlineStatus(navigator.onLine));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [dispatch]);

  // Sync Logic
  useEffect(() => {
    let syncInterval;

    const processSyncQueue = async () => {
      if (!isOnline || syncStatus === 'syncing') return;

      try {
        const pendingItems = await getPendingSyncItems();
        dispatch(setPendingItemsCount(pendingItems.length));

        if (pendingItems.length === 0) {
          if (syncStatus !== 'idle') dispatch(setSyncStatus('idle'));
          return;
        }

        dispatch(setSyncStatus('syncing'));

        // Process sequentially to maintain chronological ICV/PIH integrity
        for (const item of pendingItems) {
          try {
            if (item.payload && item.payload.url && item.payload.url.includes('/leads/scrape')) {
              await removeSyncItem(item.id);
              continue;
            }
            
            let response;
            // Replay the exact original HTTP request if available
            if (item.payload && item.payload.url && item.payload.method) {
              console.log(`[Offline-Sync] Replaying request: ${item.payload.method.toUpperCase()} ${item.payload.url}`);
              response = await api({
                url: item.payload.url,
                method: item.payload.method,
                data: item.payload.data,
                headers: {
                  ...item.payload.headers,
                  'X-Offline-Synced': 'true'
                }
              });
            } else {
              // Legacy fallback to the sync ingestion endpoint
              response = await api.post('/sync/ingest', {
                type: item.type,
                payload: item.payload,
                offlineId: item.id
              });
            }

            if (response.status === 200 || response.status === 201 || response.status === 202 || response.status === 204) {
              await removeSyncItem(item.id);
            } else {
              throw new Error('Sync failed with status ' + response.status);
            }
          } catch (error) {
            console.error(`Failed to sync item ${item.id}:`, error);
            await updateSyncItemStatus(item.id, {
              retryCount: item.retryCount + 1,
              error: error.message || 'Unknown error',
              status: item.retryCount >= 5 ? 'FAILED' : 'PENDING' // Fail permanently after 5 tries
            });
            // Stop syncing on first failure to maintain strict sequence!
            break; 
          }
        }

        // Refresh count after sync
        const remainingItems = await getPendingSyncItems();
        dispatch(setPendingItemsCount(remainingItems.length));
        dispatch(setSyncStatus(remainingItems.length > 0 ? 'error' : 'success'));
        
        setTimeout(() => dispatch(setSyncStatus('idle')), 3000);

      } catch (err) {
        console.error('Error processing sync queue:', err);
        dispatch(setSyncStatus('error'));
      }
    };

    if (isOnline) {
      // Run immediately
      processSyncQueue();
      // Then poll every 30 seconds
      syncInterval = setInterval(processSyncQueue, 30000);
    }

    return () => {
      if (syncInterval) clearInterval(syncInterval);
    };
  }, [isOnline, syncStatus, dispatch]);
}
