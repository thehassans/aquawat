import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  StickyNote,
  ListTodo,
  CalendarDays,
  X,
  Check,
  ChevronDown,
  ShoppingCart,
  Package,
  RotateCcw,
  Truck
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTranslation } from '../lib/translations';
import PremiumCalendarIcon from '../components/ui/PremiumCalendarIcon';

const EVENT_TYPES = [
  { id: 'meeting', en: 'Meeting', ar: 'اجتماع', icon: Video, color: '#2563EB' },
  { id: 'task', en: 'Task', ar: 'مهمة', icon: ListTodo, color: '#059669' },
  { id: 'note', en: 'Date Note', ar: 'ملاحظة تاريخ', icon: StickyNote, color: '#7C3AED' },
  { id: 'reminder', en: 'Reminder', ar: 'تذكير', icon: Bell, color: '#D97706' },
  { id: 'call', en: 'Call', ar: 'مكالمة', icon: Phone, color: '#DB2777' },
  { id: 'invoice_due', en: 'Invoice Due', ar: 'متابعة فاتورة', icon: FileText, color: '#0891B2' },
  { id: 'purchase_order', en: 'Purchase Order', ar: 'طلب شراء', icon: ShoppingCart, color: '#0F766E' },
  { id: 'purchase_order_expected', en: 'PO Expected', ar: 'تاريخ توريد متوقع', icon: ShoppingCart, color: '#0369A1' },
  { id: 'grn', en: 'GRN', ar: 'إشعار استلام', icon: Package, color: '#7C3AED' },
  { id: 'grn_delay', en: 'GRN Delay', ar: 'تأخير استلام', icon: Package, color: '#D97706' },
  { id: 'purchase_return', en: 'Purchase Return', ar: 'مرتجع مشتريات', icon: RotateCcw, color: '#BE123C' },
  { id: 'delivery_note', en: 'Delivery Note', ar: 'سند تسليم', icon: Truck, color: '#4F46E5' },
];

const PRESET_COLORS = [
  '#2563EB', // Royal Blue
  '#059669', // Emerald
  '#7C3AED', // Purple
  '#D97706', // Amber
  '#DB2777', // Pink
  '#0891B2', // Cyan
  '#DC2626', // Red
  '#4F46E5', // Indigo
];

const PRIORITIES = [
  { id: 'low', en: 'Low', ar: 'منخفضة' },
  { id: 'medium', en: 'Medium', ar: 'متوسطة' },
  { id: 'high', en: 'High', ar: 'عالية' },
  { id: 'urgent', en: 'Urgent', ar: 'طارئة' },
];

export default function CalendarPage() {
  const { language } = useSelector((state) => state.ui);
  const { tenant } = useSelector((state) => state.auth);
  const { t } = useTranslation(language);
  const isAr = language === 'ar';
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'agenda'
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
    color: '#2563EB',
    priority: 'medium',
    status: 'pending',
    location: '',
    meetingLink: '',
    attendees: [],
    notes: '',
    remindBeforeMinutes: 15,
  });

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

  const events = eventsData?.events || [];

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
      toast.success(isAr ? 'تم حفظ الملاحظة على التاريخ' : 'Note pinned to date');
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
      color: '#2563EB',
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

  const eventTitle = (evt) => (isAr ? (evt.titleAr || evt.title) : evt.title);

  const handleEditEvent = (evt) => {
    if (evt?.relatedHref || evt?.source === 'procurement') {
      if (evt.relatedHref) navigate(evt.relatedHref);
      return;
    }
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
      color: evt.color || '#2563EB',
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

  const today = new Date();
  const todayDayName = today.toLocaleString(isAr ? 'ar-SA' : 'en-US', { weekday: 'short' });
  const todayDateNum = today.getDate();

  const weekDayHeaders = isAr
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-dark-900 pb-16 font-sans transition-colors">
      {/* ─── ULTRA-MINIMALISTIC LIGHT EXECUTIVE HEADER ─────────────────── */}
      <div className="bg-white dark:bg-dark-800 border-b border-gray-200/80 dark:border-dark-700 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left: Dynamic Live Mini Calendar Badge + Title */}
            <div className="flex items-center gap-4">
              <PremiumCalendarIcon size="lg" date={today} />

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                    {isAr ? 'التقويم والمواعيد' : 'Calendar & Schedule'}
                  </h1>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40">
                    {monthName}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {isAr
                    ? 'جدولة المواعيد، متابعة الاجتماعات، وتدوين ملاحظات الأيام'
                    : 'Manage team meetings, pin date notes, and track daily timeline'}
                </p>
              </div>
            </div>

            {/* Right: Minimalist Action Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  setSelectedDate(new Date());
                  setIsQuickNoteOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-dark-700 hover:bg-gray-50 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-200 text-xs font-semibold border border-gray-200 dark:border-dark-600 shadow-2xs transition-all"
              >
                <StickyNote className="w-4 h-4 text-purple-600" />
                {isAr ? 'تدوين ملاحظة' : 'Quick Note'}
              </button>

              <button
                onClick={() => handleOpenNewEvent()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 text-xs font-bold shadow-sm transition-all"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                {isAr ? 'إضافة موعد / اجتماع' : 'Schedule Event'}
              </button>
            </div>
          </div>

          {/* Minimalist 4 KPI Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <div className="bg-slate-50/80 dark:bg-dark-700/40 border border-gray-200/70 dark:border-dark-600 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                  {summaryData?.todayCount || 0}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  {isAr ? 'مواعيد اليوم' : "Today's Events"}
                </div>
              </div>
            </div>

            <div className="bg-slate-50/80 dark:bg-dark-700/40 border border-gray-200/70 dark:border-dark-600 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <div className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                  {summaryData?.upcomingMeetingsCount || 0}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  {isAr ? 'اجتماعات قادمة' : 'Upcoming Meetings'}
                </div>
              </div>
            </div>

            <div className="bg-slate-50/80 dark:bg-dark-700/40 border border-gray-200/70 dark:border-dark-600 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <ListTodo className="w-4 h-4" />
              </div>
              <div>
                <div className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                  {summaryData?.pendingTasksCount || 0}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  {isAr ? 'مهام معلقة' : 'Pending Tasks'}
                </div>
              </div>
            </div>

            <div className="bg-slate-50/80 dark:bg-dark-700/40 border border-gray-200/70 dark:border-dark-600 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <div className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                  {summaryData?.monthCount || events.length}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  {isAr ? 'إجمالي الشهر' : 'Total This Month'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── CONTROLS & FILTER TOOLBAR ─────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-5">
        <div className="bg-white dark:bg-dark-800 rounded-2xl p-3 sm:p-4 border border-gray-200/80 dark:border-dark-700 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Left: Date Navigator */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-xl bg-gray-100 dark:bg-dark-700 p-1 border border-gray-200/60 dark:border-dark-600">
              <button
                onClick={prevMonth}
                className="p-1 rounded-lg hover:bg-white dark:hover:bg-dark-800 text-gray-600 dark:text-gray-300 transition-all"
                title={isAr ? 'الشهر السابق' : 'Previous Month'}
              >
                {isAr ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
              <button
                onClick={goToToday}
                className="px-2.5 py-0.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-dark-800 rounded-lg transition-all"
              >
                {isAr ? 'اليوم' : 'Today'}
              </button>
              <button
                onClick={nextMonth}
                className="p-1 rounded-lg hover:bg-white dark:hover:bg-dark-800 text-gray-600 dark:text-gray-300 transition-all"
                title={isAr ? 'الشهر التالي' : 'Next Month'}
              >
                {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>

            <span className="text-sm sm:text-base font-bold text-gray-900 dark:text-white capitalize">
              {monthName}
            </span>
          </div>

          {/* Middle: Type Selector Dropdown / Pills */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 rtl:pr-3 rtl:pl-8 py-1.5 text-xs font-semibold rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="all">{isAr ? 'جميع الأنواع' : 'All Categories'}</option>
                {EVENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {isAr ? t.ar : t.en}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 rtl:left-2.5 rtl:right-auto top-2.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Search Box */}
            <div className="relative flex-1 sm:w-44">
              <Search className="w-3.5 h-3.5 absolute left-3 rtl:right-3 rtl:left-auto top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'بحث سريع...' : 'Search...'}
                className="w-full pl-8 rtl:pr-8 rtl:pl-3 pr-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {/* View Mode Segmented Tabs */}
            <div className="inline-flex items-center rounded-xl bg-gray-100 dark:bg-dark-700 p-1 border border-gray-200/60 dark:border-dark-600">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'month'
                    ? 'bg-white dark:bg-dark-800 text-gray-900 dark:text-white shadow-2xs'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                {isAr ? 'الشهر' : 'Month'}
              </button>
              <button
                onClick={() => setViewMode('agenda')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'agenda'
                    ? 'bg-white dark:bg-dark-800 text-gray-900 dark:text-white shadow-2xs'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                {isAr ? 'الأجندة' : 'Agenda'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MAIN CALENDAR BODY ────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-5">
        {viewMode === 'month' ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Left 3 Columns: 7-Day Month Grid */}
            <div className="lg:col-span-3 bg-white dark:bg-dark-800 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-dark-700 shadow-2xs">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center">
                {weekDayHeaders.map((dayName, idx) => (
                  <div
                    key={idx}
                    className="py-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider"
                  >
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Month Day Cells */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {monthDays.map((dayObj, index) => {
                  const dateKey = dayObj.date.toISOString().split('T')[0];
                  const dayEvents = eventsByDate[dateKey] || [];
                  const isToday = isSameDay(dayObj.date, new Date());
                  const isSelected = isSameDay(dayObj.date, selectedDate);

                  return (
                    <div
                      key={index}
                      onClick={() => setSelectedDate(dayObj.date)}
                      className={`min-h-[85px] sm:min-h-[105px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group relative ${
                        isSelected
                          ? 'border-gray-900 dark:border-white bg-slate-50 dark:bg-dark-700/60 shadow-xs ring-1 ring-gray-900/10 dark:ring-white/20'
                          : isToday
                          ? 'border-rose-400 bg-rose-50/20 dark:bg-rose-950/10'
                          : dayObj.isCurrentMonth
                          ? 'border-gray-100 dark:border-dark-700 bg-white dark:bg-dark-800 hover:border-gray-300 dark:hover:border-dark-600'
                          : 'border-transparent bg-gray-50/40 dark:bg-dark-900/30 opacity-35'
                      }`}
                    >
                      {/* Cell Header: Date Number & Add Event Plus */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${
                            isToday
                              ? 'bg-rose-600 text-white shadow-2xs'
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
                          className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-md bg-gray-100 dark:bg-dark-700 text-gray-500 hover:bg-gray-900 hover:text-white dark:hover:bg-white dark:hover:text-gray-900 transition-all flex items-center justify-center"
                          title={isAr ? 'إضافة موعد' : 'Add event'}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Event Chips */}
                      <div className="mt-1 space-y-1 overflow-hidden">
                        {dayEvents.slice(0, 3).map((evt) => (
                          <div
                            key={evt._id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditEvent(evt);
                            }}
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold truncate flex items-center gap-1 hover:opacity-85 transition-opacity"
                            style={{
                              backgroundColor: `${evt.color || '#2563EB'}15`,
                              color: evt.color || '#2563EB',
                              borderLeft: isAr ? 'none' : `2px solid ${evt.color || '#2563EB'}`,
                              borderRight: isAr ? `2px solid ${evt.color || '#2563EB'}` : 'none',
                            }}
                          >
                            {evt.startTime && !evt.allDay && (
                              <span className="opacity-70 font-mono text-[9px]">{evt.startTime}</span>
                            )}
                            <span className="truncate">{eventTitle(evt)}</span>
                          </div>
                        ))}

                        {dayEvents.length > 3 && (
                          <div className="text-[9px] font-bold text-gray-400 px-1">
                            +{dayEvents.length - 3} {isAr ? 'أخرى' : 'more'}
                          </div>
                        )}
                      </div>

                      {/* Micro dot indicators */}
                      {dayEvents.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {dayEvents.slice(0, 4).map((evt, i) => (
                            <span
                              key={i}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: evt.color || '#2563EB' }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Selected Day Detail & Scratchpad */}
            <div className="space-y-4">
              {/* Selected Day Agenda Box */}
              <div className="bg-white dark:bg-dark-800 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-dark-700 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {isAr ? 'مواعيد اليوم المحدد' : 'Selected Schedule'}
                    </span>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white capitalize">
                      {selectedDate.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </h3>
                  </div>
                  <button
                    onClick={() => handleOpenNewEvent(selectedDate)}
                    className="p-1.5 rounded-lg bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Day events list */}
                <div className="mt-3.5 space-y-2 max-h-[340px] overflow-y-auto pr-0.5">
                  {selectedDateEvents.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-dark-700 flex items-center justify-center mx-auto text-gray-400 mb-2">
                        <CalendarIcon className="w-5 h-5" />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {isAr ? 'لا توجد مواعيد في هذا اليوم' : 'No events for this date'}
                      </p>
                      <button
                        onClick={() => handleOpenNewEvent(selectedDate)}
                        className="mt-2 text-xs font-bold text-gray-900 dark:text-white hover:underline"
                      >
                        {isAr ? '+ إضافة موعد' : '+ Add Event'}
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
                          className="p-3 rounded-xl bg-gray-50/80 dark:bg-dark-700/50 border border-gray-100 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500 transition-all cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                style={{
                                  backgroundColor: `${evt.color || '#2563EB'}20`,
                                  color: evt.color || '#2563EB',
                                }}
                              >
                                <IconComp className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <h4
                                  className={`text-xs font-bold text-gray-900 dark:text-white ${
                                    evt.isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : ''
                                  }`}
                                >
                                  {eventTitle(evt)}
                                </h4>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
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

                          {evt.meetingLink && (
                            <a
                              href={evt.meetingLink}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold hover:bg-blue-100 transition-colors"
                            >
                              <Video className="w-3 h-3" />
                              {isAr ? 'انضمام' : 'Join'}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Quick Date Note Box */}
              <div className="bg-white dark:bg-dark-800 rounded-2xl p-4 border border-gray-200/80 dark:border-dark-700 shadow-2xs">
                <div className="flex items-center gap-2 pb-2.5 border-b border-gray-100 dark:border-dark-700">
                  <StickyNote className="w-4 h-4 text-purple-600" />
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    {isAr ? 'ملاحظة سريعة للتاريخ' : 'Pin Note to Date'}
                  </h3>
                </div>

                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={quickNoteTitle}
                    onChange={(e) => setQuickNoteTitle(e.target.value)}
                    placeholder={isAr ? 'عنوان الملاحظة (اختياري)' : 'Note title (optional)'}
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                  <textarea
                    rows={2}
                    value={quickNoteText}
                    onChange={(e) => setQuickNoteText(e.target.value)}
                    placeholder={isAr ? 'اكتب ملاحظة أو محضر لهذا اليوم...' : 'Type note or minutes for this day...'}
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none"
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
                    className="w-full py-1.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {isAr ? 'تثبيت الملاحظة' : 'Save Note'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ─── AGENDA VIEW ───────────────────────────────────────────── */
          <div className="bg-white dark:bg-dark-800 rounded-2xl p-5 sm:p-6 border border-gray-200/80 dark:border-dark-700 shadow-2xs">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-gray-600" />
              {isAr ? 'الأجندة والمواعيد القادمة' : 'Upcoming Agenda & Tasks'}
            </h3>

            {events.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-dark-700 text-gray-400 flex items-center justify-center mx-auto mb-2">
                  <CalendarIcon className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                  {isAr ? 'لا توجد مواعيد مسجلة' : 'No upcoming events'}
                </h4>
                <button
                  onClick={() => handleOpenNewEvent()}
                  className="mt-3 px-3.5 py-1.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold shadow-xs"
                >
                  {isAr ? '+ إنشاء موعد الآن' : '+ Create Event'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((evt) => {
                  const typeConfig = EVENT_TYPES.find((t) => t.id === evt.type) || EVENT_TYPES[0];
                  const IconComp = typeConfig.icon;
                  const d = new Date(evt.startDate);

                  return (
                    <div
                      key={evt._id}
                      onClick={() => handleEditEvent(evt)}
                      className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-dark-700/50 border border-gray-200/70 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 flex flex-col items-center justify-center flex-shrink-0 shadow-2xs">
                          <span className="text-[9px] font-black uppercase text-rose-600 leading-none">
                            {d.toLocaleString(isAr ? 'ar-SA' : 'en-US', { month: 'short' })}
                          </span>
                          <span className="text-xs font-black text-gray-900 dark:text-white leading-none mt-0.5">
                            {d.getDate()}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                              style={{
                                backgroundColor: `${evt.color || '#2563EB'}15`,
                                color: evt.color || '#2563EB',
                              }}
                            >
                              {isAr ? typeConfig.ar : typeConfig.en}
                            </span>
                            <span className="text-[10px] text-gray-400 font-semibold uppercase">
                              {evt.priority || 'medium'}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-gray-900 dark:text-white mt-1">
                            {eventTitle(evt)}
                          </h4>

                          <div className="flex items-center flex-wrap gap-2.5 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            {evt.startTime && (
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

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {evt.meetingLink && (
                          <a
                            href={evt.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 shadow-2xs"
                          >
                            <Video className="w-3 h-3" />
                            {isAr ? 'انضمام' : 'Join'}
                          </a>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCompleteMutation.mutate(evt._id);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                            evt.isCompleted
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-white dark:bg-dark-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-dark-600'
                          }`}
                        >
                          {evt.isCompleted ? (isAr ? 'مكتمل ✓' : 'Done ✓') : isAr ? 'إتمام' : 'Mark Done'}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-xl bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-gray-200 dark:border-dark-700 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-5 py-3.5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between bg-gray-50/50 dark:bg-dark-900/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      {selectedEvent
                        ? isAr
                          ? 'تعديل تفاصيل الموعد'
                          : 'Edit Event'
                        : isAr
                        ? 'جدولة موعد جديد'
                        : 'Schedule New Event'}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setIsEventModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {isAr ? 'عنوان الموعد / الاجتماع' : 'Event / Meeting Title'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={isAr ? 'مثال: مراجعة العرض مع العميل' : 'e.g., Client project review'}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {isAr ? 'نوع الموعد' : 'Category'}
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {EVENT_TYPES.map((t) => {
                      const IconComp = t.icon;
                      const isSelected = formData.type === t.id;
                      return (
                        <button
                          type="button"
                          key={t.id}
                          onClick={() => setFormData({ ...formData, type: t.id, color: t.color })}
                          className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                            isSelected
                              ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-dark-700 text-gray-900 dark:text-white font-bold'
                              : 'border-gray-200 dark:border-dark-600 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          <IconComp className="w-3.5 h-3.5" style={{ color: t.color }} />
                          <span className="text-[10px]">{isAr ? t.ar : t.en}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date & Time Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50/80 dark:bg-dark-700/40 p-3 rounded-xl border border-gray-200 dark:border-dark-600">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      {isAr ? 'تاريخ البدء' : 'Start Date'} *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white"
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
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white"
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
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white"
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
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white"
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
                        className="rounded text-gray-900 focus:ring-gray-900"
                      />
                      {isAr ? 'طوال اليوم (All Day)' : 'All Day'}
                    </label>

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

                {/* Links & Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      {isAr ? 'رابط الاجتماع (Zoom / Meet)' : 'Meeting URL'}
                    </label>
                    <input
                      type="url"
                      value={formData.meetingLink}
                      onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                      placeholder="https://meet.google.com/..."
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      {isAr ? 'الموقع / القاعة' : 'Location / Room'}
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder={isAr ? 'غرفة الاجتماعات' : 'Meeting Room'}
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Color Palette */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {isAr ? 'اللون' : 'Color'}
                  </label>
                  <div className="flex items-center gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setFormData({ ...formData, color: c })}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          formData.color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-900' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {isAr ? 'ملاحظات وجدول الأعمال' : 'Notes & Agenda'}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={isAr ? 'اكتب ملاحظات إضافية هنا...' : 'Type additional details here...'}
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white resize-none"
                  />
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-dark-700">
                  {selectedEvent ? (
                    <button
                      type="button"
                      onClick={() => deleteEventMutation.mutate(selectedEvent._id)}
                      className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {isAr ? 'حذف' : 'Delete'}
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEventModalOpen(false)}
                      className="px-3.5 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>

                    <button
                      type="submit"
                      disabled={createEventMutation.isPending || updateEventMutation.isPending}
                      className="px-4 py-1.5 text-xs font-bold bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 text-white rounded-xl shadow-xs transition-all"
                    >
                      {createEventMutation.isPending || updateEventMutation.isPending
                        ? isAr
                          ? 'جاري الحفظ...'
                          : 'Saving...'
                        : selectedEvent
                        ? isAr
                          ? 'حفظ التعديل'
                          : 'Save Changes'
                        : isAr
                        ? 'تأكيد وحفظ'
                        : 'Confirm & Save'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── QUICK NOTE MODAL ─────────────────────────────────────────── */}
      <AnimatePresence>
        {isQuickNoteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-gray-200 dark:border-dark-700 p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <StickyNote className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    {isAr ? 'تدوين ملاحظة على تاريخ' : 'Pin Note to Date'}
                  </h3>
                </div>
                <button onClick={() => setIsQuickNoteOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
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
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white"
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
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  {isAr ? 'نص الملاحظة' : 'Content'} *
                </label>
                <textarea
                  rows={3}
                  value={quickNoteText}
                  onChange={(e) => setQuickNoteText(e.target.value)}
                  placeholder={isAr ? 'اكتب الملاحظة هنا...' : 'Type note content here...'}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickNoteOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
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
                  className="px-4 py-1.5 text-xs font-bold bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 text-white rounded-xl shadow-xs"
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
