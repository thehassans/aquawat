import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Plus, Search, Filter, Target, Award, TrendingUp, AlertCircle, ChevronRight, CheckCircle2, X, Save, Trash2, Star } from 'lucide-react';
import api from '../../lib/api';

export default function Performance() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('reviews');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ employeeId: '', reviewPeriod: '', reviewDate: '', reviewer: '', rating: '', goals: [], strengths: '', areasToImprove: '', actionItems: '', status: 'draft', overallComments: '' });

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['hr-reviews', search],
    queryFn: () => api.get('/hr/performance', { params: { search } }).then(r => r.data),
  });
  const { data: employees } = useQuery({
    queryKey: ['employees-mini'],
    queryFn: () => api.get('/employees?limit=500').then(r => r.data?.employees || []),
  });

  const mut = useMutation({
    mutationFn: (payload) => editing ? api.put(`/hr/performance/${editing._id}`, payload) : api.post('/hr/performance', payload),
    onSuccess: () => { toast.success(editing ? 'Updated' : 'Created'); qc.invalidateQueries({ queryKey: ['hr-reviews'] }); closeModal(); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });
  const delMut = useMutation({
    mutationFn: (id) => api.delete(`/hr/performance/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['hr-reviews'] }); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const openModal = (r = null) => {
    setEditing(r);
    setForm(r ? {
      employeeId: r.employeeId || '', reviewPeriod: r.reviewPeriod || '', reviewDate: r.reviewDate ? r.reviewDate.slice(0, 10) : '',
      reviewer: r.reviewer || '', rating: r.rating || '', goals: r.goals || [], strengths: r.strengths || '',
      areasToImprove: r.areasToImprove || '', actionItems: r.actionItems || '', status: r.status || 'draft', overallComments: r.overallComments || '',
    } : { employeeId: '', reviewPeriod: '', reviewDate: '', reviewer: '', rating: '', goals: [], strengths: '', areasToImprove: '', actionItems: '', status: 'draft', overallComments: '' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const getEmployeeName = (id) => { const e = (employees || []).find(x => x._id === id); return e ? `${e.firstName || ''} ${e.lastName || ''}`.trim() : 'Unknown'; };
  const filteredReviews = (reviews || []).filter(r => !search || getEmployeeName(r.employeeId).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Performance Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track employee goals, appraisals, and overall performance.</p>
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-sm transition-colors font-medium">
          <Plus className="w-4 h-4" />
          {activeTab === 'goals' ? 'Set New Goal' : 'Start Review'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-white dark:bg-dark-800 p-1 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 w-fit">
        <button onClick={() => setActiveTab('reviews')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'reviews' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
          <Award className="w-4 h-4" />
          Performance Reviews ({(reviews || []).length})
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-gray-400"><div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"/></div>
      ) : (
        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-dark-700 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Reviews</h2>
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-dark-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20" />
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-dark-900/50 border-b border-gray-100 dark:border-dark-700">
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Review Period</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rating</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reviewer</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
              {filteredReviews.map((review) => (
                <tr key={review._id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                  <td className="py-4 px-6 whitespace-nowrap font-medium text-gray-900 dark:text-white">{getEmployeeName(review.employeeId)}</td>
                  <td className="py-4 px-6 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{review.reviewPeriod}</td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400"/>
                      <span className="text-lg font-bold text-gray-900 dark:text-white">{review.rating}</span>
                      <span className="text-sm text-gray-400">/ 5</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{review.reviewer}</td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${review.status === 'completed' ? 'bg-green-100 text-green-700' : review.status === 'in_review' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{review.status}</span>
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openModal(review)} className="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline">Edit</button>
                      <button onClick={() => { if (window.confirm('Delete?')) delMut.mutate(review._id); }} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {filteredReviews.length === 0 && <div className="py-12 text-center text-gray-500">No reviews found.</div>}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-700">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{editing ? 'Edit Review' : 'New Performance Review'}</h2>
                <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5"/></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="text-xs font-medium text-gray-500">Employee</label><select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm"><option value="">Select employee</option>{(employees || []).map(e => <option key={e._id} value={e._id}>{e.firstName} {e.lastName}</option>)}</select></div>
                  <div><label className="text-xs font-medium text-gray-500">Reviewer</label><input value={form.reviewer} onChange={e => setForm(f => ({ ...f, reviewer: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm"/></div>
                  <div><label className="text-xs font-medium text-gray-500">Review Period</label><input value={form.reviewPeriod} onChange={e => setForm(f => ({ ...f, reviewPeriod: e.target.value }))} placeholder="e.g. Q2 2024" className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm"/></div>
                  <div><label className="text-xs font-medium text-gray-500">Review Date</label><input type="date" value={form.reviewDate} onChange={e => setForm(f => ({ ...f, reviewDate: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm"/></div>
                  <div><label className="text-xs font-medium text-gray-500">Rating (1-5)</label><input type="number" min={1} max={5} step={0.1} value={form.rating} onChange={e => setForm(f => ({ ...f, rating: Number(e.target.value) }))} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm"/></div>
                  <div><label className="text-xs font-medium text-gray-500">Status</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm"><option value="draft">draft</option><option value="in_review">in_review</option><option value="completed">completed</option></select></div>
                </div>
                <div><label className="text-xs font-medium text-gray-500">Strengths</label><textarea value={form.strengths} onChange={e => setForm(f => ({ ...f, strengths: e.target.value }))} rows={2} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm"/></div>
                <div><label className="text-xs font-medium text-gray-500">Areas to Improve</label><textarea value={form.areasToImprove} onChange={e => setForm(f => ({ ...f, areasToImprove: e.target.value }))} rows={2} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm"/></div>
                <div><label className="text-xs font-medium text-gray-500">Action Items</label><textarea value={form.actionItems} onChange={e => setForm(f => ({ ...f, actionItems: e.target.value }))} rows={2} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm"/></div>
                <div><label className="text-xs font-medium text-gray-500">Overall Comments</label><textarea value={form.overallComments} onChange={e => setForm(f => ({ ...f, overallComments: e.target.value }))} rows={3} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm"/></div>
              </div>
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 dark:border-dark-700">
                <button onClick={closeModal} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                <button onClick={() => mut.mutate(form)} disabled={mut.isPending} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"><Save className="w-4 h-4"/> {mut.isPending ? 'Saving...' : 'Save'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
