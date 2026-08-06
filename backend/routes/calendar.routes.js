import express from 'express';
import { protect } from '../middleware/auth.js';
import CalendarEvent from '../models/CalendarEvent.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Apply auth middleware to all calendar routes
router.use(protect);

/**
 * Helper to get tenant ID from authenticated request
 */
const getTenantId = (req) => {
  return req.user?.tenantId || req.tenant?._id;
};

/**
 * GET /api/calendar
 * Fetch events within a date range with optional filtering
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const {
      startDate,
      endDate,
      month,
      year,
      type,
      priority,
      status,
      search,
      isCompleted,
      limit = 200,
    } = req.query;

    const query = { tenantId };

    // Date range filter
    if (startDate && endDate) {
      query.startDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (month && year) {
      const parsedYear = parseInt(year, 10);
      const parsedMonth = parseInt(month, 10) - 1; // 0-indexed in JS Date
      const startOfMonth = new Date(Date.UTC(parsedYear, parsedMonth, 1, 0, 0, 0));
      const endOfMonth = new Date(Date.UTC(parsedYear, parsedMonth + 1, 0, 23, 59, 59, 999));
      query.startDate = { $gte: startOfMonth, $lte: endOfMonth };
    }

    // Type filter
    if (type && type !== 'all') {
      if (type.includes(',')) {
        query.type = { $in: type.split(',') };
      } else {
        query.type = type;
      }
    }

    // Priority filter
    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Completed filter
    if (typeof isCompleted !== 'undefined' && isCompleted !== '') {
      query.isCompleted = isCompleted === 'true';
    }

    // Search filter
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { location: searchRegex },
        { notes: searchRegex },
        { tags: searchRegex },
        { 'attendees.name': searchRegex },
      ];
    }

    const events = await CalendarEvent.find(query)
      .sort({ startDate: 1, startTime: 1 })
      .limit(Math.min(parseInt(limit, 10) || 200, 500))
      .lean();

    res.json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    logger.error('Error fetching calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events', details: error.message });
  }
});

/**
 * GET /api/calendar/summary
 * KPI summary for the current user/tenant calendar
 */
router.get('/summary', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [todayEvents, monthEvents, pendingTasks, upcomingMeetings] = await Promise.all([
      CalendarEvent.countDocuments({
        tenantId,
        startDate: { $gte: startOfToday, $lte: endOfToday },
      }),
      CalendarEvent.countDocuments({
        tenantId,
        startDate: { $gte: startOfMonth, $lte: endOfMonth },
      }),
      CalendarEvent.countDocuments({
        tenantId,
        type: { $in: ['task', 'reminder'] },
        isCompleted: false,
      }),
      CalendarEvent.countDocuments({
        tenantId,
        type: 'meeting',
        startDate: { $gte: startOfToday },
      }),
    ]);

    res.json({
      success: true,
      summary: {
        todayCount: todayEvents,
        monthCount: monthEvents,
        pendingTasksCount: pendingTasks,
        upcomingMeetingsCount: upcomingMeetings,
      },
    });
  } catch (error) {
    logger.error('Error fetching calendar summary:', error);
    res.status(500).json({ error: 'Failed to fetch calendar summary', details: error.message });
  }
});

/**
 * GET /api/calendar/:id
 * Retrieve a single calendar event
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const event = await CalendarEvent.findOne({ _id: req.params.id, tenantId }).lean();
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ success: true, event });
  } catch (error) {
    logger.error('Error fetching calendar event:', error);
    res.status(500).json({ error: 'Failed to fetch calendar event', details: error.message });
  }
});

/**
 * POST /api/calendar
 * Create a new calendar event, meeting, task, or note
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const {
      title,
      description,
      type,
      startDate,
      endDate,
      allDay,
      startTime,
      endTime,
      color,
      priority,
      status,
      location,
      meetingLink,
      attendees,
      relatedContact,
      relatedCustomer,
      notes,
      tags,
      remindBeforeMinutes,
    } = req.body;

    if (!title || !startDate) {
      return res.status(400).json({ error: 'Title and start date are required' });
    }

    const newEvent = await CalendarEvent.create({
      tenantId,
      userId: req.user?._id,
      title: title.trim(),
      description: description ? description.trim() : '',
      type: type || 'meeting',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : new Date(startDate),
      allDay: Boolean(allDay),
      startTime: startTime || '',
      endTime: endTime || '',
      color: color || '#3B82F6',
      priority: priority || 'medium',
      status: status || 'pending',
      location: location ? location.trim() : '',
      meetingLink: meetingLink ? meetingLink.trim() : '',
      attendees: Array.isArray(attendees) ? attendees : [],
      relatedContact: relatedContact || undefined,
      relatedCustomer: relatedCustomer || undefined,
      notes: notes || '',
      tags: Array.isArray(tags) ? tags : [],
      remindBeforeMinutes: remindBeforeMinutes || 15,
      isCompleted: false,
    });

    res.status(201).json({
      success: true,
      message: 'Calendar event created successfully',
      event: newEvent,
    });
  } catch (error) {
    logger.error('Error creating calendar event:', error);
    res.status(500).json({ error: 'Failed to create calendar event', details: error.message });
  }
});

/**
 * POST /api/calendar/quick-note
 * Fast-add a note or reminder to a specific date
 */
router.post('/quick-note', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const { date, note, time, title } = req.body;
    if (!date || (!note && !title)) {
      return res.status(400).json({ error: 'Date and note content or title are required' });
    }

    const parsedDate = new Date(date);
    const event = await CalendarEvent.create({
      tenantId,
      userId: req.user?._id,
      title: title ? title.trim() : (note.length > 50 ? `${note.substring(0, 47)}...` : note),
      notes: note || '',
      type: 'note',
      startDate: parsedDate,
      endDate: parsedDate,
      allDay: !time,
      startTime: time || '',
      color: '#8B5CF6',
      priority: 'medium',
    });

    res.status(201).json({
      success: true,
      message: 'Note added to calendar date successfully',
      event,
    });
  } catch (error) {
    logger.error('Error creating quick calendar note:', error);
    res.status(500).json({ error: 'Failed to create quick note', details: error.message });
  }
});

/**
 * PUT /api/calendar/:id
 * Update an existing calendar event
 */
router.put('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const event = await CalendarEvent.findOne({ _id: req.params.id, tenantId });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const updatableFields = [
      'title',
      'description',
      'type',
      'startDate',
      'endDate',
      'allDay',
      'startTime',
      'endTime',
      'color',
      'priority',
      'status',
      'location',
      'meetingLink',
      'attendees',
      'relatedContact',
      'relatedCustomer',
      'notes',
      'tags',
      'remindBeforeMinutes',
      'isCompleted',
    ];

    updatableFields.forEach((field) => {
      if (typeof req.body[field] !== 'undefined') {
        if (field === 'startDate' || field === 'endDate') {
          event[field] = req.body[field] ? new Date(req.body[field]) : event[field];
        } else {
          event[field] = req.body[field];
        }
      }
    });

    if (req.body.isCompleted && !event.completedAt) {
      event.completedAt = new Date();
    } else if (req.body.isCompleted === false) {
      event.completedAt = null;
    }

    await event.save();

    res.json({
      success: true,
      message: 'Calendar event updated successfully',
      event,
    });
  } catch (error) {
    logger.error('Error updating calendar event:', error);
    res.status(500).json({ error: 'Failed to update calendar event', details: error.message });
  }
});

/**
 * PATCH /api/calendar/:id/toggle-complete
 * Quick toggle of completion status
 */
router.patch('/:id/toggle-complete', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const event = await CalendarEvent.findOne({ _id: req.params.id, tenantId });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    event.isCompleted = !event.isCompleted;
    event.completedAt = event.isCompleted ? new Date() : null;
    if (event.isCompleted && event.status === 'pending') {
      event.status = 'completed';
    }

    await event.save();

    res.json({
      success: true,
      message: event.isCompleted ? 'Event marked as completed' : 'Event marked as pending',
      event,
    });
  } catch (error) {
    logger.error('Error toggling calendar event completion:', error);
    res.status(500).json({ error: 'Failed to toggle status', details: error.message });
  }
});

/**
 * DELETE /api/calendar/:id
 * Delete a calendar event
 */
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const event = await CalendarEvent.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({
      success: true,
      message: 'Calendar event deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting calendar event:', error);
    res.status(500).json({ error: 'Failed to delete calendar event', details: error.message });
  }
});

export default router;
