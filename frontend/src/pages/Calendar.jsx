import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Video,
  Users,
  CheckCircle2,
  Circle,
  FileText,
  Phone,
  Bell,
  Search,
  Filter,
  Trash2,
  Edit3,
  ExternalLink,
  Tag,
  AlertCircle,
  StickyNote,
  ListTodo,
  CalendarDays,
  Sparkles,
  X,
  Check,
  Share2,
  Copy,
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTranslation } from '../lib/translations';

const EVENT_TYPES = [
  { id: 'meeting', en: 'Meeting', ar: 'اجتماع', icon: Video, color: '#3B82F6' },
  { id: 'task', en: 'Task', ar: 'مهمة', icon: ListTodo, color: '#10B981' },
  { id: 'note', en: 'Date Note', ar: 'ملاحظة تاريخ', icon: StickyNote, color: '#8B5CF6' },
  { id: 'reminder', en: 'Reminder', ar: 'تذكير', icon: Bell, color: '#F59E0B' },
  { id: 'call', en: 'Call', ar: 'مكالمة', icon: Phone, color: '#EC4899' },
  { id: 'invoice_due', en: 'Invoice Follow-up', ar: 'متابعة فاتورة', icon: FileText, color: '#06B6D4' },
];

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#6366F1', // Indigo
];

const PRIORITIES = [
  { id: 'low', en: 'Low', ar: 'منخفضة', color: 'text-gray-500 bg-gray-100 dark:bg-gray-800' },
  { id: 'medium', en: 'Medium', ar: 'متوسطة', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
  { id: 'high', en: 'High', ar: 'عالية', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' },
  { id: 'urgent', en: 'Urgent', ar: 'طارئة', color: 'text-red-600 bg-red-50 dark:bg-red-900/30' },
];

export default function CalendarPage() {
  const { language } = useSelector((state) => state.ui);
  const { tenant, user } = useSelector((state) => state.auth);
  const { t } = useTranslation(language);
  const isAr = language === 'ar';
  const queryClient = useQueryClient();

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'day' | 'agenda'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [quickNoteTitle, setQuickNoteTitle] = useState('');

  // Event Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'meeting',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    allDay: false,
    startTime: '09:00',
    endTime: '10:00',
    color: '#3B82F6',
    priority: 'medium',
    status: 'pending',
    location: '',
    meetingLink: '',
    attendees: [],
    notes: '',
    remindBeforeMinutes: 15,
  });

  const [newAttendee, setNewAttendee] = useState({ name: '', email: '', phone: '' });

  // Calculate year & month query parameters
  const queryYear = currentDate.getFullYear();
  const queryMonth = currentDate.getMonth() + 1;

  // Fetch events for current month (or expanded range)
  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['calendar-events', queryYear, queryMonth, selectedTypeFilter, searchQuery],
    queryFn: async () => {
      const params = {
        year: queryYear,
        month: queryMonth,
      };
      if (selectedTypeFilter !== 'all') params.type = selectedTypeFilter;
      if (searchQuery) params.search = searchQuery;
      const res = await api.get('/calendar', { params });
      return res.data;
    },
  });

  // Fetch summary KPI
  const { data: summaryData } = useQuery({
    queryKey: ['calendar-summary'],
    queryFn: async () => {
      const res = await api.get('/calendar/summary');
      return res.data?.summary || {};
    },
  });

  // Fetch contacts for attendee auto-suggestions
  const { data: contactsData } = useQuery({
    queryKey: ['contacts-list-mini'],
    queryFn: async () => {
      const res = await api.get('/contacts', { params: { limit: 100 } });
      return res.data?.contacts || [];
    },
  });

  const events = eventsData?.events || [];
  const contacts = contactsData || [];

  // Mutations
  const createEventMutation = useMutation({
    mutationFn: (data) => api.post('/calendar', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['calendar-events']);
      queryClient.invalidateQueries(['calendar-summary']);
      toast.success(isAr ? 'تم حفظ الموعد بنجاح' : 'Event scheduled successfully');
      setIsEventModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (isAr ? 'فشل حفظ الموعد' : 'Failed to save event'));
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/calendar/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['calendar-events']);
      queryClient.invalidateQueries(['calendar-summary']);
      toast.success(isAr ? 'تم تحديث الموعد بنجاح' : 'Event updated successfully');
      setIsEventModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (isAr ? 'فشل تحديث الموعد' : 'Failed to update event'));
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id) => api.delete(`/calendar/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['calendar-events']);
      queryClient.invalidateQueries(['calendar-summary']);
      toast.success(isAr ? 'تم حذف الموعد' : 'Event deleted');
      setIsEventModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (isAr ? 'فشل الحذف' : 'Failed to delete'));
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: (id) => api.patch(`/calendar/${id}/toggle-complete`),
    onSuccess: () => {
      queryClient.invalidateQueries(['calendar-events']);
      queryClient.invalidateQueries(['calendar-summary']);
    },
  });

  const quickNoteMutation = useMutation({
    mutationFn: (data) => api.post('/calendar/quick-note', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['calendar-events']);
      queryClient.invalidateQueries(['calendar-summary']);
      toast.success(isAr ? 'تم حفظ الملاحظة على التاريخ' : 'Note added to date');
      setIsQuickNoteOpen(false);
      setQuickNoteText('');
      setQuickNoteTitle('');
    },
  });

  const resetForm = () => {
    setSelectedEvent(null);
    setFormData({
      title: '',
      description: '',
      type: 'meeting',
      startDate: selectedDate.toISOString().split('T')[0],
      endDate: selectedDate.toISOString().split('T')[0],
      allDay: false,
      startTime: '09:00',
      endTime: '10:00',
      color: '#3B82F6',
      priority: 'medium',
      status: 'pending',
      location: '',
      meetingLink: '',
      attendees: [],
      notes: '',
      remindBeforeMinutes: 15,
    });
  };

  const handleOpenNewEvent = (dateOverride = null) => {
    resetForm();
    if (dateOverride) {
      const dStr = dateOverride.toISOString().split('T')[0];
      setFormData((prev) => ({
        ...prev,
        startDate: dStr,
        endDate: dStr,
      }));
    }
    setIsEventModalOpen(true);
  };

  const handleEditEvent = (evt) => {
    setSelectedEvent(evt);
    setFormData({
      title: evt.title || '',
      description: evt.description || '',
      type: evt.type || 'meeting',
      startDate: evt.startDate ? new Date(evt.startDate).toISOString().split('T')[0] : '',
      endDate: evt.endDate ? new Date(evt.endDate).toISOString().split('T')[0] : '',
      allDay: Boolean(evt.allDay),
      startTime: evt.startTime || '09:00',
      endTime: evt.endTime || '10:00',
      color: evt.color || '#3B82F6',
      priority: evt.priority || 'medium',
      status: evt.status || 'pending',
      location: evt.location || '',
      meetingLink: evt.meetingLink || '',
      attendees: evt.attendees || [],
      notes: evt.notes || '',
      remindBeforeMinutes: evt.remindBeforeMinutes || 15,
    });
    setIsEventModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error(isAr ? 'الرجاء إدخال عنوان الموعد أو الملاحظة' : 'Title is required');
      return;
    }

    if (selectedEvent) {
      updateEventMutation.mutate({ id: selectedEvent._id, data: formData });
    } else {
      createEventMutation.mutate(formData);
    }
  };

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Calendar grid calculations
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month padding days to complete 6-row grid (42 cells)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentDate]);

  // Group events by date string "YYYY-MM-DD"
  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach((evt) => {
      if (!evt.startDate) return;
      const key = new Date(evt.startDate).toISOString().split('T')[0];
      if (!map[key]) map[key] = [];
      map[key].push(evt);
    });
    return map;
  }, [events]);

  const isSameDay = (d1, d2) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const selectedDateEvents = useMemo(() => {
    const key = selectedDate.toISOString().split('T')[0];
    return eventsByDate[key] || [];
  }, [selectedDate, eventsByDate]);

  const monthName = currentDate.toLocaleString(isAr ? 'ar-SA' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });

  const weekDayHeaders = isAr
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-dark-900 pb-12 font-sans transition-colors">
      {/* ─── TOP HERO / HEADER BAR ────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 text-white shadow-lg">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-4 rtl:space-x-reverse">
              {/* Dynamic 3D Live Calendar Badge */}
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-dark-800 shadow-xl flex flex-col items-center justify-center p-1 border-2 border-white/40 flex-shrink-0">
                <div className="w-full bg-rose-600 text-white rounded-t-lg text-[9px] font-black uppercase text-center py-0.5 tracking-wider">
                  {new Date().toLocaleString(isAr ? 'ar-SA' : 'en-US', { weekday: 'short' })}
                </div>
                <div className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                  {new Date().getDate()}
                </div>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
                  {isAr ? 'التقويم والمواعيد الذكية' : 'Calendar & Meetings'}
                  <span className="text-xs bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full font-medium border border-white/20">
                    Pro
                  </span>
                </h1>
                <p className="text-rose-100 text-xs sm:text-sm mt-0.5 font-light">
                  {isAr
                    ? 'جدولة الاجتماعات، تدوين ملاحظات التواريخ، ومتابعة المهام والمواعيد اللحظية'
                    : 'Schedule meetings, pin daily notes, track tasks, and manage timeline'}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center flex-wrap gap-2">
              <button
                onClick={() => {
                  setSelectedDate(new Date());
                  setIsQuickNoteOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-md border border-white/25 transition-all shadow-sm"
              >
                <StickyNote className="w-4 h-4" />
                {isAr ? 'تدوين ملاحظة سريعة' : 'Quick Date Note'}
              </button>

              <button
                onClick={() => handleOpenNewEvent()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-rose-600 hover:bg-rose-50 text-xs sm:text-sm font-bold shadow-lg shadow-black/10 hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                {isAr ? 'موعد / اجتماع جديد' : 'New Event / Meeting'}
              </button>
            </div>
          </div>

          {/* KPI Micro Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                <CalendarIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-lg font-black">{summaryData?.todayCount || 0}</div>
                <div className="text-[11px] text-rose-100 font-medium">{isAr ? 'مواعيد اليوم' : "Today's Schedule"}</div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-lg font-black">{summaryData?.upcomingMeetingsCount || 0}</div>
                <div className="text-[11px] text-rose-100 font-medium">{isAr ? 'اجتماعات قادمة' : 'Upcoming Meetings'}</div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                <ListTodo className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-lg font-black">{summaryData?.pendingTasksCount || 0}</div>
                <div className="text-[11px] text-rose-100 font-medium">{isAr ? 'مهام معلقة' : 'Pending Tasks'}</div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-lg font-black">{summaryData?.monthCount || events.length}</div>
                <div className="text-[11px] text-rose-100 font-medium">{isAr ? 'إجمالي الشهر' : 'Total This Month'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── CONTROLS & FILTER BAR ────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white dark:bg-dark-800 rounded-2xl p-4 shadow-sm border border-gray-200/80 dark:border-dark-700 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Left: Month Navigator & Today Button */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-100 dark:bg-dark-700 rounded-xl p-1 border border-gray-200 dark:border-dark-600">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-dark-800 text-gray-700 dark:text-gray-300 transition-all"
                title={isAr ? 'الشهر السابق' : 'Previous Month'}
              >
                {isAr ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-dark-800 rounded-lg transition-all"
              >
                {isAr ? 'اليوم' : 'Today'}
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-dark-800 text-gray-700 dark:text-gray-300 transition-all"
                title={isAr ? 'الشهر التالي' : 'Next Month'}
              >
                {isAr ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white capitalize">
              {monthName}
            </h2>
          </div>

          {/* Middle: Type Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedTypeFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                selectedTypeFilter === 'all'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
              }`}
            >
              {isAr ? 'الكل' : 'All'}
            </button>
            {EVENT_TYPES.map((type) => {
              const IconComp = type.icon;
              const isSelected = selectedTypeFilter === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedTypeFilter(type.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" style={{ color: isSelected ? 'inherit' : type.color }} />
                  {isAr ? type.ar : type.en}
                </button>
              );
            })}
          </div>

          {/* Right: View Switcher & Search */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-4 h-4 absolute left-3 rtl:right-3 rtl:left-auto top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'بحث في المواعيد...' : 'Search events...'}
                className="w-full pl-9 rtl:pr-9 rtl:pl-3 pr-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center bg-gray-100 dark:bg-dark-700 rounded-xl p-1 border border-gray-200 dark:border-dark-600">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'month'
                    ? 'bg-white dark:bg-dark-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                {isAr ? 'شهر' : 'Month'}
              </button>
              <button
                onClick={() => setViewMode('agenda')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'agenda'
                    ? 'bg-white dark:bg-dark-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                {isAr ? 'الأجندة' : 'Agenda'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MAIN CALENDAR CONTENT ────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {viewMode === 'month' ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left 3 Columns: 7-Day Month Grid */}
            <div className="lg:col-span-3 bg-white dark:bg-dark-800 rounded-3xl p-4 sm:p-6 shadow-sm border border-gray-200/80 dark:border-dark-700">
              {/* Weekday Header */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center">
                {weekDayHeaders.map((dayName, idx) => (
                  <div
                    key={idx}
                    className="py-2 text-[11px] sm:text-xs font-black uppercase text-gray-400 dark:text-gray-500 tracking-wider"
                  >
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Month Days Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {monthDays.map((dayObj, index) => {
                  const dateKey = dayObj.date.toISOString().split('T')[0];
                  const dayEvents = eventsByDate[dateKey] || [];
                  const isToday = isSameDay(dayObj.date, new Date());
                  const isSelected = isSameDay(dayObj.date, selectedDate);

                  return (
                    <motion.div
                      key={index}
                      whileHover={{ scale: 0.99 }}
                      onClick={() => setSelectedDate(dayObj.date)}
                      className={`min-h-[90px] sm:min-h-[110px] p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group relative ${
                        isSelected
                          ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 shadow-md ring-2 ring-rose-500/20'
                          : isToday
                          ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/10'
                          : dayObj.isCurrentMonth
                          ? 'border-gray-100 dark:border-dark-700 bg-white dark:bg-dark-800 hover:border-gray-300 dark:hover:border-dark-600'
                          : 'border-transparent bg-gray-50/50 dark:bg-dark-900/40 opacity-40'
                      }`}
                    >
                      {/* Top: Date Number & Add Button */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-xl text-xs font-bold ${
                            isToday
                              ? 'bg-rose-600 text-white shadow-md'
                              : isSelected
                              ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {dayObj.date.getDate()}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenNewEvent(dayObj.date);
                          }}
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg bg-gray-100 dark:bg-dark-700 text-gray-600 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center"
                          title={isAr ? 'إضافة موعد' : 'Add event'}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Event Chips */}
                      <div className="mt-1.5 space-y-1 overflow-hidden">
                        {dayEvents.slice(0, 3).map((evt) => (
                          <div
                            key={evt._id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditEvent(evt);
                            }}
                            className="px-1.5 py-0.5 rounded-lg text-[10px] font-semibold truncate flex items-center gap-1 shadow-2xs hover:opacity-80 transition-opacity"
                            style={{
                              backgroundColor: `${evt.color || '#3B82F6'}18`,
                              color: evt.color || '#3B82F6',
                              borderLeft: isAr ? 'none' : `2.5px solid ${evt.color || '#3B82F6'}`,
                              borderRight: isAr ? `2.5px solid ${evt.color || '#3B82F6'}` : 'none',
                            }}
                          >
                            {evt.startTime && !evt.allDay && (
                              <span className="opacity-75 font-mono text-[9px]">{evt.startTime}</span>
                            )}
                            <span className="truncate">{evt.title}</span>
                          </div>
                        ))}

                        {dayEvents.length > 3 && (
                          <div className="text-[9px] font-bold text-gray-400 px-1">
                            +{dayEvents.length - 3} {isAr ? 'أخرى' : 'more'}
                          </div>
                        )}
                      </div>

                      {/* Bottom indicator dot if notes/tasks exist */}
                      {dayEvents.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {dayEvents.slice(0, 4).map((evt, i) => (
                            <span
                              key={i}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: evt.color || '#3B82F6' }}
                            />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Selected Day Detail & Quick Notes */}
            <div className="space-y-6">
              {/* Selected Day Agenda Box */}
              <div className="bg-white dark:bg-dark-800 rounded-3xl p-5 shadow-sm border border-gray-200/80 dark:border-dark-700">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
                  <div>
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">
                      {isAr ? 'مواعيد اليوم المحدد' : 'Selected Day'}
                    </span>
                    <h3 className="text-base font-extrabold text-gray-900 dark:text-white capitalize">
                      {selectedDate.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </h3>
                  </div>
                  <button
                    onClick={() => handleOpenNewEvent(selectedDate)}
                    className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Day events list */}
                <div className="mt-4 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {selectedDateEvents.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-dark-700 flex items-center justify-center mx-auto text-gray-400 mb-2">
                        <CalendarIcon className="w-6 h-6" />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {isAr ? 'لا توجد مواعيد مسجلة في هذا اليوم' : 'No events scheduled for this day'}
                      </p>
                      <button
                        onClick={() => handleOpenNewEvent(selectedDate)}
                        className="mt-3 text-xs font-bold text-rose-600 hover:underline"
                      >
                        {isAr ? '+ إضافة موعد أو ملاحظة' : '+ Add event or note'}
                      </button>
                    </div>
                  ) : (
                    selectedDateEvents.map((evt) => {
                      const typeConfig = EVENT_TYPES.find((t) => t.id === evt.type) || EVENT_TYPES[0];
                      const IconComp = typeConfig.icon;

                      return (
                        <div
                          key={evt._id}
                          onClick={() => handleEditEvent(evt)}
                          className="p-3 rounded-2xl bg-gray-50 dark:bg-dark-700/60 border border-gray-100 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500 transition-all cursor-pointer group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                              <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                                style={{
                                  backgroundColor: `${evt.color || '#3B82F6'}20`,
                                  color: evt.color || '#3B82F6',
                                }}
                              >
                                <IconComp className="w-4 h-4" />
                              </div>
                              <div>
                                <h4
                                  className={`text-xs font-bold text-gray-900 dark:text-white ${
                                    evt.isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : ''
                                  }`}
                                >
                                  {evt.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                  {evt.allDay ? (
                                    <span>{isAr ? 'طوال اليوم' : 'All day'}</span>
                                  ) : (
                                    <span className="flex items-center gap-1 font-mono">
                                      <Clock className="w-3 h-3" />
                                      {evt.startTime} {evt.endTime ? `- ${evt.endTime}` : ''}
                                    </span>
                                  )}
                                  {evt.location && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {evt.location}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Quick Complete Toggle for tasks */}
                            {evt.type === 'task' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCompleteMutation.mutate(evt._id);
                                }}
                                className="text-gray-400 hover:text-emerald-600 transition-colors"
                              >
                                {evt.isCompleted ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Circle className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Meeting Join Button if link exists */}
                          {evt.meetingLink && (
                            <a
                              href={evt.meetingLink}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold hover:bg-blue-100 transition-colors"
                            >
                              <Video className="w-3 h-3" />
                              {isAr ? 'انضمام للاجتماع' : 'Join Meeting'}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Quick Scratchpad / Date Notes */}
              <div className="bg-white dark:bg-dark-800 rounded-3xl p-5 shadow-sm border border-gray-200/80 dark:border-dark-700">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
                  <div className="flex items-center gap-2">
                    <StickyNote className="w-4 h-4 text-purple-600" />
                    <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      {isAr ? 'ملاحظة على تاريخ اليوم' : 'Date Quick Note'}
                    </h3>
                  </div>
                </div>

                <div className="mt-3 space-y-2.5">
                  <input
                    type="text"
                    value={quickNoteTitle}
                    onChange={(e) => setQuickNoteTitle(e.target.value)}
                    placeholder={isAr ? 'عنوان الملاحظة (اختياري)' : 'Note title (optional)'}
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <textarea
                    rows={3}
                    value={quickNoteText}
                    onChange={(e) => setQuickNoteText(e.target.value)}
                    placeholder={
                      isAr
                        ? 'دوّن ملخص اجتماع أو فكرة لهذا التاريخ...'
                        : 'Jot down meeting minutes or reminder...'
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                  <button
                    onClick={() => {
                      if (!quickNoteText.trim() && !quickNoteTitle.trim()) {
                        toast.error(isAr ? 'اكتب ملاحظتك أولاً' : 'Please type note content');
                        return;
                      }
                      quickNoteMutation.mutate({
                        date: selectedDate,
                        title: quickNoteTitle,
                        note: quickNoteText,
                      });
                    }}
                    disabled={quickNoteMutation.isPending}
                    className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {isAr ? 'تثبيت الملاحظة على التاريخ' : 'Pin Note to Date'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ─── AGENDA STREAM VIEW ────────────────────────────────────── */
          <div className="bg-white dark:bg-dark-800 rounded-3xl p-6 shadow-sm border border-gray-200/80 dark:border-dark-700">
            <h3 className="text-base font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-rose-600" />
              {isAr ? 'الأجندة والمواعيد القادمة' : 'Upcoming Agenda & Tasks'}
            </h3>

            {events.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mx-auto mb-3">
                  <CalendarIcon className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  {isAr ? 'لا توجد مواعيد مسجلة' : 'No upcoming events found'}
                </h4>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                  {isAr
                    ? 'ابدأ بجدولة اجتماعاتك وملاحظاتك اليومية عبر الضغط على موعد جديد'
                    : 'Start organizing your schedule and notes by clicking New Event'}
                </p>
                <button
                  onClick={() => handleOpenNewEvent()}
                  className="mt-4 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-lg"
                >
                  {isAr ? '+ إنشاء موعد الآن' : '+ Create Event Now'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((evt) => {
                  const typeConfig = EVENT_TYPES.find((t) => t.id === evt.type) || EVENT_TYPES[0];
                  const IconComp = typeConfig.icon;
                  const d = new Date(evt.startDate);

                  return (
                    <div
                      key={evt._id}
                      onClick={() => handleEditEvent(evt)}
                      className="p-4 rounded-2xl bg-gray-50/70 dark:bg-dark-700/50 border border-gray-200/70 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                    >
                      <div className="flex items-start gap-4">
                        {/* Date badge */}
                        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 flex flex-col items-center justify-center flex-shrink-0 shadow-2xs">
                          <span className="text-[9px] font-black uppercase text-rose-600">
                            {d.toLocaleString(isAr ? 'ar-SA' : 'en-US', { month: 'short' })}
                          </span>
                          <span className="text-sm font-black text-gray-900 dark:text-white leading-none">
                            {d.getDate()}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{
                                backgroundColor: `${evt.color || '#3B82F6'}15`,
                                color: evt.color || '#3B82F6',
                              }}
                            >
                              {isAr ? typeConfig.ar : typeConfig.en}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-dark-600 text-gray-700 dark:text-gray-300 font-semibold uppercase">
                              {evt.priority || 'medium'}
                            </span>
                          </div>

                          <h4 className="text-sm font-extrabold text-gray-900 dark:text-white mt-1">
                            {evt.title}
                          </h4>

                          {evt.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                              {evt.description}
                            </p>
                          )}

                          <div className="flex items-center flex-wrap gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {evt.startTime && (
                              <span className="flex items-center gap-1 font-mono">
                                <Clock className="w-3.5 h-3.5" />
                                {evt.startTime} {evt.endTime ? `- ${evt.endTime}` : ''}
                              </span>
                            )}
                            {evt.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {evt.location}
                              </span>
                            )}
                            {evt.attendees?.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {evt.attendees.length} {isAr ? 'مشاركين' : 'attendees'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right actions */}
                      <div className="flex items-center gap-2 self-end md:self-center">
                        {evt.meetingLink && (
                          <a
                            href={evt.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                          >
                            <Video className="w-3.5 h-3.5" />
                            {isAr ? 'انضمام' : 'Join'}
                          </a>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCompleteMutation.mutate(evt._id);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                            evt.isCompleted
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-white dark:bg-dark-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-dark-600'
                          }`}
                        >
                          {evt.isCompleted
                            ? isAr
                              ? 'مكتمل ✓'
                              : 'Completed ✓'
                            : isAr
                            ? 'إتمام'
                            : 'Mark Done'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── CREATE / EDIT EVENT MODAL ────────────────────────────────── */}
      <AnimatePresence>
        {isEventModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-white dark:bg-dark-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-dark-700 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-rose-600 to-amber-500 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black">
                      {selectedEvent
                        ? isAr
                          ? 'تعديل تفاصيل الموعد'
                          : 'Edit Event'
                        : isAr
                        ? 'جدولة موعد / اجتماع جديد'
                        : 'Schedule New Event'}
                    </h3>
                    <p className="text-[11px] text-rose-100 font-light">
                      {isAr ? 'املأ الحقول التالية لإضافة الموعد للتقويم' : 'Fill details below to save'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEventModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
                {/* Event Title */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {isAr ? 'عنوان الموعد / الاجتماع' : 'Event / Meeting Title'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={
                      isAr
                        ? 'مثال: اجتماع مناقشة العرض المالي مع شركة الأفق'
                        : 'e.g., Financial proposal review with client'
                    }
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                {/* Event Type Grid Selector */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {isAr ? 'نوع الموعد' : 'Event Type'}
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {EVENT_TYPES.map((t) => {
                      const IconComp = t.icon;
                      const isSelected = formData.type === t.id;
                      return (
                        <button
                          type="button"
                          key={t.id}
                          onClick={() => setFormData({ ...formData, type: t.id, color: t.color })}
                          className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                            isSelected
                              ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-600 shadow-xs'
                              : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-700'
                          }`}
                        >
                          <IconComp className="w-4 h-4" style={{ color: t.color }} />
                          <span className="text-[10px] font-bold">{isAr ? t.ar : t.en}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date & Time Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 dark:bg-dark-700/40 p-3.5 rounded-2xl border border-gray-200 dark:border-dark-600">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      {isAr ? 'تاريخ البدء' : 'Start Date'} *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      {isAr ? 'تاريخ الانتهاء' : 'End Date'}
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white"
                    />
                  </div>

                  {!formData.allDay && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                          {isAr ? 'وقت البدء' : 'Start Time'}
                        </label>
                        <input
                          type="time"
                          value={formData.startTime}
                          onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                          {isAr ? 'وقت الانتهاء' : 'End Time'}
                        </label>
                        <input
                          type="time"
                          value={formData.endTime}
                          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white"
                        />
                      </div>
                    </>
                  )}

                  <div className="sm:col-span-2 flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={formData.allDay}
                        onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                      {isAr ? 'حدث طوال اليوم (All Day)' : 'All-Day Event'}
                    </label>

                    {/* Priority Selector */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-gray-500">{isAr ? 'الأولوية:' : 'Priority:'}</span>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="text-xs px-2 py-1 rounded-lg bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white"
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p.id} value={p.id}>
                            {isAr ? p.ar : p.en}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Meeting Link & Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                      <Video className="w-3.5 h-3.5 text-blue-500" />
                      {isAr ? 'رابط الاجتماع الافتراضي' : 'Meeting Link (Zoom / Meet)'}
                    </label>
                    <input
                      type="url"
                      value={formData.meetingLink}
                      onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                      placeholder="https://meet.google.com/..."
                      className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-red-500" />
                      {isAr ? 'المكان / القاعة' : 'Location / Room'}
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder={isAr ? 'غرفة الاجتماعات الرئيسية' : 'HQ Boardroom'}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Color Preset Palette */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {isAr ? 'لون التمييز' : 'Highlight Color'}
                  </label>
                  <div className="flex items-center gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setFormData({ ...formData, color: c })}
                        className={`w-7 h-7 rounded-full transition-transform ${
                          formData.color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Notes & Description */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-purple-500" />
                    {isAr ? 'ملاحظات وجدول الأعمال' : 'Meeting Notes & Agenda'}
                  </label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={
                      isAr
                        ? 'أضف نقاط النقاش، مخرجات الاجتماع، أو الملاحظات الهامة...'
                        : 'Add agenda points, discussion topics or action items...'
                    }
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                {/* Action Buttons Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-dark-700">
                  {selectedEvent ? (
                    <button
                      type="button"
                      onClick={() => deleteEventMutation.mutate(selectedEvent._id)}
                      className="px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      {isAr ? 'حذف الموعد' : 'Delete'}
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEventModalOpen(false)}
                      className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-xl transition-colors"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>

                    <button
                      type="submit"
                      disabled={createEventMutation.isPending || updateEventMutation.isPending}
                      className="px-5 py-2 text-xs font-black bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-700 hover:to-amber-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all"
                    >
                      {createEventMutation.isPending || updateEventMutation.isPending
                        ? isAr
                          ? 'جاري الحفظ...'
                          : 'Saving...'
                        : selectedEvent
                        ? isAr
                          ? 'حفظ التعديلات'
                          : 'Save Changes'
                        : isAr
                        ? 'تأكيد وحفظ الموعد'
                        : 'Confirm & Save'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── QUICK NOTE DRAWER MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {isQuickNoteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-dark-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-dark-700 p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center">
                    <StickyNote className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      {isAr ? 'تدوين ملاحظة على تاريخ' : 'Pin Note to Date'}
                    </h3>
                    <p className="text-[10px] text-gray-400">
                      {selectedDate.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsQuickNoteOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  {isAr ? 'التاريخ' : 'Date'}
                </label>
                <input
                  type="date"
                  value={selectedDate.toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(new Date(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  {isAr ? 'عنوان الملاحظة' : 'Note Title'}
                </label>
                <input
                  type="text"
                  value={quickNoteTitle}
                  onChange={(e) => setQuickNoteTitle(e.target.value)}
                  placeholder={isAr ? 'عنوان مختصر' : 'Brief title'}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  {isAr ? 'نص الملاحظة' : 'Note Content'} *
                </label>
                <textarea
                  rows={4}
                  value={quickNoteText}
                  onChange={(e) => setQuickNoteText(e.target.value)}
                  placeholder={isAr ? 'اكتب ملاحظتك بالتفصيل هنا...' : 'Type note content here...'}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickNoteOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 rounded-xl"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!quickNoteText.trim() && !quickNoteTitle.trim()) {
                      toast.error(isAr ? 'اكتب ملاحظتك أولاً' : 'Please type note content');
                      return;
                    }
                    quickNoteMutation.mutate({
                      date: selectedDate,
                      title: quickNoteTitle,
                      note: quickNoteText,
                    });
                  }}
                  disabled={quickNoteMutation.isPending}
                  className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-md"
                >
                  {quickNoteMutation.isPending ? (isAr ? 'حفظ...' : 'Saving...') : isAr ? 'حفظ الملاحظة' : 'Save Note'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
