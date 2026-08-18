import express from 'express';
import { protect, tenantFilter, requireTenantFilter } from '../middleware/auth.js';
import {
  getDashboardStats,
  getMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getSubscriptions,
  createSubscription,
  freezeSubscription,
  unfreezeSubscription,
  processCheckIn,
  getAttendanceLogs,
  getClasses,
  createClass,
  updateClass,
  bookClassMember,
  deleteClass,
  getMemberMeasurements,
  createMeasurement,
  getLockers,
  createLocker,
  assignLocker,
  releaseLocker,
  getPTSessions,
  createPTSession,
  updatePTSessionStatus,
  deletePTSession,
} from '../controllers/gymController.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

// Dashboard
router.get('/dashboard', getDashboardStats);

// Members
router.get('/members', getMembers);
router.get('/members/:id', getMemberById);
router.post('/members', createMember);
router.put('/members/:id', updateMember);
router.delete('/members/:id', deleteMember);

// Plans
router.get('/plans', getPlans);
router.post('/plans', createPlan);
router.put('/plans/:id', updatePlan);
router.delete('/plans/:id', deletePlan);

// Subscriptions & Freeze
router.get('/subscriptions', getSubscriptions);
router.post('/subscriptions', createSubscription);
router.post('/subscriptions/:id/freeze', freezeSubscription);
router.post('/subscriptions/:id/unfreeze', unfreezeSubscription);

// Access & Check-In Kiosk
router.post('/check-in', processCheckIn);
router.get('/attendance', getAttendanceLogs);

// Classes & Timetable
router.get('/classes', getClasses);
router.post('/classes', createClass);
router.put('/classes/:id', updateClass);
router.post('/classes/:id/book', bookClassMember);
router.delete('/classes/:id', deleteClass);

// InBody & Measurements
router.get('/members/:memberId/measurements', getMemberMeasurements);
router.post('/measurements', createMeasurement);

// Lockers
router.get('/lockers', getLockers);
router.post('/lockers', createLocker);
router.post('/lockers/:id/assign', assignLocker);
router.post('/lockers/:id/release', releaseLocker);

// Personal Training (PT) Sessions
router.get('/pt-sessions', getPTSessions);
router.post('/pt-sessions', createPTSession);
router.put('/pt-sessions/:id', updatePTSessionStatus);
router.delete('/pt-sessions/:id', deletePTSession);

export default router;
