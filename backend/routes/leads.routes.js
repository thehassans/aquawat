import express from 'express';
import { scrapeLeads } from '../controllers/leads.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/scrape', protect, authorize('superadmin'), scrapeLeads);

export default router;
