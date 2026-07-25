import express from 'express';
import multer from 'multer';
import { 
  getLeadSetups, 
  getLeadSetupByType, 
  createOrUpdateLeadSetup,
  deleteLeadSetup
} from '../controllers/leadSetup.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Memory storage for multer
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Protect all routes - super admin only
router.use(protect);
router.use(authorize('super_admin'));

router.get('/', getLeadSetups);
router.get('/:type', getLeadSetupByType);
router.post('/', upload.single('bannerImage'), createOrUpdateLeadSetup);
router.delete('/:id', deleteLeadSetup);

export default router;
