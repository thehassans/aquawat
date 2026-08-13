import express from 'express';
import { ingestSyncItem } from '../controllers/syncController.js';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';

const router = express.Router();

// All sync endpoints require authentication
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

// Ingest an offline-generated item
router.post('/ingest', ingestSyncItem);

export default router;
