import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Plus, Search, Filter, CalendarDays, CheckCircle2, XCircle, Clock, MoreVertical, PlaneTakeoff, ShieldAlert, X, Save, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import ResponsiveDataList from '../../components/ui/ResponsiveDataList';

const LEAVE_TYPES = ['annual', 'sick', 'personal', 'unpaid', 'emergency', 'maternity', 'paternity', 'bereavement'];
const STATUS_OPTS = ['pending', 'approved', 'rejected', 'cancelled'];
const BALANCE_META = {
  annual: { label: 'Annual Leave', icon: PlaneTakeoff, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  sick: { label: 'Sick Leave', icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
  personal: { label: 'Personal Leave', icon: CalendarDays, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
};

function initForm(req) {
  if (!req) return { employeeId: '', leaveType: 'annual', startDate: '', endDate: '', days: 1, reason: '', status: 'pending' };
  return { employeeId: req.employeeId || '', leaveType: req.leaveType || 'annual', startDate: req.startDate ? req.startDate.slice(0, 10) : '', endDate: req.endDate ? req.endDate.slice(0, 10) : '', days: req.days || 1, reason: req.reason || '', status: req.status || 'pending' };
}

export default function Leaves() {
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initForm());

  const { data: leaves, isLoading } = useQuery({
    queryKey: ['hr-leaves', searchQuery, filterStatus],
    queryFn: () => api.get('/hr/leaves', { params: { search: searchQuery, status: filterStatus } }).then(r => r.data),
  });

  const { data: employees } = useQuery({
    queryKey: ['employees-mini'],
    queryFn: () => api.get('/employees?limit=500').then(r => r.data?.employees || []),
  });

  const mut = useMutation({
    mutationFn: (payload) => editing ? api.put(`/hr/leaves/${editing._id}`, payload) : api.post('/hr/leaves', payload),
    onSuccess: () => { toast.success(editing ? 'Updated' : 'Created'); qc.invalidateQueries({ queryKey: ['hr-leaves'] }); closeModal(); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });
  const delMut = useMutation({
    mutationFn: (id) => api.delete(`/hr/leaves/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['hr-leaves'] }); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });
  const statusMut = useMutation({
    mutationFn: ({ id, status }) => api.put(`/hr/leaves/${id}`, { status }),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['hr-leaves'] }); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const openModal = (req = null) => { setEditing(req); setForm(initForm(req)); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const requests = Array.isArray(leaves) ? leaves : [];
  const filteredRequests = requests.filter(r => {
    const emp = (employees || []).find(e => e._id === r.employeeId);
    const name = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : '';
    return (!filterStatus || r.status === filterStatus) && (!searchQuery || name.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const getEmployeeName = (id) => { const e = (employees || []).find(x => x._id === id); return e ? `${e.firstName || ''} ${e.lastName || ''}`.trim() : 'Unknown'; };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leaves & Time Off</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage employee leave requests and balances.</p>
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-sm transition-colors font-medium">
          <Plus className="w-4 h-4" />
          Request Leave
        </button>
      </div>

      {/* Leave Balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['annual', 'sick', 'personal'].map((type) => {
          const meta = BALANCE_META[type];
          const total = (employees || []).reduce((sum, e) => sum + (e.leaveBalance?.[type] || 0), 0);
          const used = (employees || []).reduce((sum, e) => sum + (e.leaveBalance?.used?.[type] || 0), 0);
          const left = total - used;
          const pct = total ? (used / total) * 100 : 0;
          return (
            <div key={type} className="bg-white dark:bg-dark-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-dark-700 flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full ${meta.bg} ${meta.color} flex items-center justify-center`}>
                <meta.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{meta.label}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{left}</span>
                  <span className="text-sm text-gray-500">days left</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-dark-700 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div className={`h-full rounded-full ${meta.color.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>{used} Used</span>
                  <span>{total} Total</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Requests Section */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-dark-700 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Requests</h2>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-dark-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-gray-50 dark:bg-dark-900 border-none rounded-xl text-sm py-2 px-4 focus:ring-2 focus:ring-primary-500/20 text-gray-700 dark:text-gray-300 outline-none">
              <option value="">All Status</option>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        </div>

        <div>
          {isLoading ? (
            <div className="py-20 text-center text-gray-400"><div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"/></div>
          ) : (
            <ResponsiveDataList
              items={filteredRequests}
              empty={<div className="py-12 text-center text-gray-500">No leave requests found.</div>}
              className="p-4 md:p-0"
              renderCard={(req) => (
                <div key={req._id} className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{getEmployeeName(req.employeeId)}</p>
                      <p className="text-xs text-gray-500 capitalize mt-0.5">{req.leaveType} · {req.days} days</p>
                      <p className="text-xs text-gray-500 mt-1">{req.startDate?.slice(0, 10)} to {req.endDate?.slice(0, 10)}</p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      req.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      req.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {req.status === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                       req.status === 'rejected' ? <XCircle className="w-3.5 h-3.5" /> :
                       <Clock className="w-3.5 h-3.5" />}
                      {req.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    {req.status === 'pending' && (
                      <>
                        <button onClick={() => statusMut.mutate({ id: req._id, status: 'approved' })} className="text-xs px-2.5 py-2 min-h-11 rounded-md bg-green-50 text-green-600 hover:bg-green-100 font-medium">Approve</button>
                        <button onClick={() => statusMut.mutate({ id: req._id, status: 'rejected' })} className="text-xs px-2.5 py-2 min-h-11 rounded-md bg-red-50 text-red-600 hover:bg-red-100 font-medium">Reject</button>
                      </>
                    )}
                    <button type="button" onClick={() => openModal(req)} className="p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg"><MoreVertical className="w-4 h-4"/></button>
                    <button type="button" onClick={() => { if (window.confirm('Delete?')) delMut.mutate(req._id); }} className="p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center text-gray-400 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              )}
            >
              {filteredRequests.length === 0 ? (
                <div className="py-12 text-center text-gray-500">No leave requests found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-dark-900/50">
                        <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                        <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Leave Type</th>
                        <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                        <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                        <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                      {filteredRequests.map((req) => (
                        <tr key={req._id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                          <td className="py-4 px-6 whitespace-nowrap">
                            <span className="font-medium text-gray-900 dark:text-white">{getEmployeeName(req.employeeId)}</span>
                          </td>
                          <td className="py-4 px-6 whitespace-nowrap">
                            <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">{req.leaveType}</span>
                          </td>
                          <td className="py-4 px-6 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">{req.startDate?.slice(0, 10)} to {req.endDate?.slice(0, 10)}</div>
                            <div className="text-xs text-gray-500">{req.days} days</div>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs block">{req.reason}</span>
                          </td>
                          <td className="py-4 px-6 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                              req.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              req.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>
                              {req.status === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                               req.status === 'rejected' ? <XCircle className="w-3.5 h-3.5" /> :
                               <Clock className="w-3.5 h-3.5" />}
                              {req.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              {req.status === 'pending' && (
                                <>
                                  <button onClick={() => statusMut.mutate({ id: req._id, status: 'approved' })} className="text-xs px-2 py-1 rounded-md bg-green-50 text-green-600 hover:bg-green-100 font-medium">Approve</button>
                                  <button onClick={() => statusMut.mutate({ id: req._id, status: 'rejected' })} className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 font-medium">Reject</button>
                                </>
                              )}
                              <button onClick={() => openModal(req)} className="text-gray-400 hover:text-gray-600"><MoreVertical className="w-4 h-4"/></button>
                              <button onClick={() => { if (window.confirm('Delete?')) delMut.mutate(req._id); }} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ResponsiveDataList>
          )}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-700">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{editing ? 'Edit Leave' : 'New Leave Request'}</h2>
                <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5"/></button>
              </div>
              <div className="p-6 space-y-4">
                <div><label className="text-xs font-medium text-gray-500">Employee</label><select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm"><option value="">Select employee</option>{(employees || []).map(e => <option key={e._id} value={e._id}>{e.firstName} {e.lastName}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-medium text-gray-500">Leave Type</label><select value={form.leaveType} onChange={e => setForm(f => ({ ...f, leaveType: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm">{LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                  <div><label className="text-xs font-medium text-gray-500">Days</label><input type="number" min={1} value={form.days} onChange={e => setForm(f => ({ ...f, days: Number(e.target.value) }))} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm"/></div>
                  <div><label className="text-xs font-medium text-gray-500">Start Date</label><input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm"/></div>
                  <div><label className="text-xs font-medium text-gray-500">End Date</label><input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm"/></div>
                </div>
                <div><label className="text-xs font-medium text-gray-500">Reason</label><textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3} className="w-full mt-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg text-sm"/></div>
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
