import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Plus, Search, X, Save, Trash2, FileDown,
  Users, Eye, ThumbsUp, ThumbsDown, CheckCircle, PhoneCall,
  HelpCircle, Monitor, ArrowUpRight, ArrowDownRight,
  Send, Globe, Lock, Mail, Link
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import SuperAdminPortal, { SA_MODAL_Z } from '../../components/super-admin/SuperAdminPortal';
import { formatSubscriptionDate } from '../../lib/subscriptionState';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const STATUS = {
  new:           { label: 'New',           color: 'bg-slate-100 text-slate-700', icon: HelpCircle },
  attended:      { label: 'Attended',      color: 'bg-blue-100 text-blue-700',    icon: Eye },
  interested:    { label: 'Interested',    color: 'bg-emerald-100 text-emerald-700', icon: ThumbsUp },
  not_interested:{ label: 'Not Interested',color: 'bg-rose-100 text-rose-700',    icon: ThumbsDown },
  converted:     { label: 'Converted',     color: 'bg-violet-100 text-violet-700',  icon: CheckCircle },
  follow_up:     { label: 'Follow Up',     color: 'bg-amber-100 text-amber-700',  icon: PhoneCall },
};

const SERVICE = {
  hardware: { label: 'Hardware', color: '#f59e0b' },
  software: { label: 'Software', color: '#3b82f6' },
  both:     { label: 'Both',     color: '#10b981' },
  none:     { label: 'None',     color: '#94a3b8' },
};

const TENANT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'trading', label: 'Trading' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'car_rental', label: 'Car Rental' },
  { value: 'bakala', label: 'Bakala / Supermarket' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'saloon', label: 'Saloon / Barber' },
  { value: 'khayyat', label: 'Tailor / Boutique' },
  { value: 'manpower', label: 'Manpower' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'construction', label: 'Construction' },
  { value: 'travel_agency', label: 'Travel Agency' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'unknown', label: 'Pending / Unknown' },
  { value: 'local_city', label: 'Local / Unknown City' },
];

const LANG_PAIRS = [
  { value: 'en+ar', label: 'English + Arabic',  flag: '🇸🇦', desc: 'English & عربي' },
  { value: 'en+hi', label: 'English + Hindi',   flag: '🇮🇳', desc: 'English & हिंदी' },
  { value: 'en+ur', label: 'English + Urdu',    flag: '🇵🇰', desc: 'English & اردو' },
  { value: 'en+bn', label: 'English + Bengali', flag: '🇧🇩', desc: 'English & বাংলা' },
  { value: 'en+fa', label: 'English + Afghan',  flag: '🇦🇫', desc: 'English & دری/پښتو' },
];

const PIE_COLORS = ['#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#3b82f6', '#10b981', '#64748b'];

export default function QueriesCRM() {
  const { language } = useSelector((state) => state.ui);
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', serviceInterest: '', tenantType: '' });
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [form, setForm] = useState({ phoneNumber: '', name: '', status: 'new', serviceInterest: 'none', tenantType: '', city: '', notes: '', newNote: '' });

  // Demo modal state
  const [demoLead, setDemoLead] = useState(null);
  const [demoForm, setDemoForm] = useState({
    langPair: 'en+ar',
    loginUrl: 'https://maqder.com/login',
    email: '',
    password: '',
  });

  const { data: stats } = useQuery({
    queryKey: ['leads-stats'],
    queryFn: () => api.get('/super-admin/leads/stats').then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['leads', page, search, filters],
    queryFn: () => api.get('/super-admin/leads', { params: { page, limit: 50, search, ...filters } }).then(r => r.data),
  });

  const createM = useMutation({
    mutationFn: (p) => api.post('/super-admin/leads', p),
    onSuccess: () => { toast.success('Lead added'); qc.invalidateQueries(['leads','leads-stats']); closeModal(); },
    onError: (e) => toast.error(e.response?.data?.error || 'Error'),
  });
  const updateM = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/super-admin/leads/${id}`, payload),
    onSuccess: () => { toast.success('Updated'); qc.invalidateQueries(['leads','leads-stats']); closeModal(); },
    onError: (e) => toast.error(e.response?.data?.error || 'Error'),
  });
  const deleteM = useMutation({
    mutationFn: (id) => api.delete(`/super-admin/leads/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries(['leads','leads-stats']); },
  });
  const quickM = useMutation({
    mutationFn: ({ id, status }) => api.put(`/super-admin/leads/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries(['leads','leads-stats']),
  });
  const sendDemoM = useMutation({
    mutationFn: ({ id, payload }) => api.post(`/super-admin/leads/${id}/send-demo`, payload),
    onSuccess: (res) => {
      toast.success(`✅ Demo sent to ${res.data?.sentTo}`);
      qc.invalidateQueries(['leads','leads-stats']);
      setDemoLead(null);
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to send demo'),
  });

  const openModal = (lead = null) => {
    setEditingLead(lead);
    setForm(lead ? { phoneNumber: lead.phoneNumber || '', name: lead.name || '', status: lead.status || 'new', serviceInterest: lead.serviceInterest || 'none', tenantType: lead.tenantType || '', city: lead.city || '', notes: lead.notes || '', newNote: '' }
                : { phoneNumber: '', name: '', status: 'new', serviceInterest: 'none', tenantType: '', city: '', notes: '', newNote: '' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditingLead(null); };
  const handleSubmit = () => {
    if (!form.phoneNumber.trim()) return toast.error('Phone number required');
    editingLead ? updateM.mutate({ id: editingLead._id, payload: form }) : createM.mutate(form);
  };

  const openDemoModal = (lead) => {
    setDemoLead(lead);
    setDemoForm({ langPair: 'en+ar', loginUrl: 'https://maqder.com/login', email: '', password: '' });
  };

  const handleSendDemo = () => {
    if (!demoLead) return;
    sendDemoM.mutate({ id: demoLead._id, payload: demoForm });
  };

  const exportCsv = () => {
    if (!data?.leads?.length) return toast.error('Nothing to export');
    const h = ['Phone','Name','Status','Service','Tenant Type','City','Notes','Created'];
    const b = data.leads.map(l => [l.phoneNumber, (l.name||'').replace(/,/g,' '), l.status, l.serviceInterest, l.tenantType, l.city, (l.notes||'').replace(/,/g,' '), new Date(l.createdAt).toLocaleString()]);
    const blob = new Blob([[h,...b].map(r=>r.join(',')).join('\n')], { type:'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `leads_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const kpis = useMemo(() => {
    const s = stats || {};
    return [
      { l:'Total Leads', v:s.total||0, i:Users, g:'from-slate-600 to-slate-500' },
      { l:'New', v:s.new||0, i:HelpCircle, g:'from-gray-500 to-gray-400' },
      { l:'Attended', v:s.attended||0, i:Eye, g:'from-blue-500 to-blue-400' },
      { l:'Interested', v:s.interested||0, i:ThumbsUp, g:'from-emerald-500 to-emerald-400' },
      { l:'Not Interested', v:s.notInterested||0, i:ThumbsDown, g:'from-rose-500 to-rose-400' },
      { l:'Converted', v:s.converted||0, i:CheckCircle, g:'from-violet-500 to-violet-400' },
      { l:'Follow Up', v:s.followUp||0, i:PhoneCall, g:'from-amber-500 to-amber-400' },
    ];
  }, [stats]);

  const tenantLabelMap = useMemo(() => Object.fromEntries(TENANT_TYPES.map(t => [t.value, t.label])), []);
  const svcData = useMemo(() => (stats?.byService||[]).filter(x=>x._id).map(x=>({ name:SERVICE[x._id]?.label||x._id, value:x.count, color:SERVICE[x._id]?.color||'#94a3b8' })), [stats]);
  const tntData = useMemo(() => (stats?.byTenant||[]).filter(x=>x._id).map((x,i)=>({ name:tenantLabelMap[x._id]||x._id, value:x.count, fill:PIE_COLORS[i%PIE_COLORS.length] })), [stats, tenantLabelMap]);
  const filterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Queries / Leads CRM</h1>
          <p className="text-gray-500 mt-1">Manage incoming queries and potential customers</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportCsv} className="btn btn-secondary"><FileDown className="w-4 h-4" /> Export</button>
          <button onClick={()=>openModal()} className="btn btn-primary"><Plus className="w-4 h-4" /> Add Lead</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {kpis.map((k,i)=>{
          const Icon=k.i;
          return (
            <motion.div key={k.l} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}} className="card p-5">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.g} flex items-center justify-center mb-3 shadow-lg`}><Icon className="w-5 h-5 text-white"/></div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{k.l}</p>
              <p className="text-3xl font-black tracking-tighter text-gray-900 dark:text-white">{k.v}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Charts + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:.35}} className="card p-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Service Interest</h3>
          {svcData.length===0?<div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data</div>:
            <><div className="h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={svcData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">{svcData.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div>
            <div className="grid grid-cols-2 gap-2 mt-2">{svcData.map((e,i)=>(<div key={i} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor:e.color}}/><span className="text-xs text-gray-600">{e.name}: {e.value}</span></div>))}</div></>}
        </motion.div>
        <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:.4}} className="card p-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Tenant Type</h3>
          {tntData.length===0?<div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data</div>:
            <><div className="h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={tntData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">{tntData.map((e,i)=><Cell key={i} fill={e.fill}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div>
            <div className="grid grid-cols-2 gap-2 mt-2">{tntData.map((e,i)=>(<div key={i} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor:e.fill}}/><span className="text-xs text-gray-600 capitalize">{e.name}: {e.value}</span></div>))}</div></>}
        </motion.div>
        <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:.45}} className="card p-6 flex flex-col">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Conversion Funnel</h3>
          {(()=>{const s=stats||{},t=s.total||1,f=[{l:'New',v:s.new||0,c:'bg-slate-500'},{l:'Attended',v:s.attended||0,c:'bg-blue-500'},{l:'Interested',v:s.interested||0,c:'bg-emerald-500'},{l:'Converted',v:s.converted||0,c:'bg-violet-500'}];
          return <div className="flex-1 flex flex-col justify-center gap-3">{f.map(step=>{const pct=Math.round((step.v/t)*100);return(<div key={step.l}><div className="flex justify-between text-xs font-bold text-gray-500 mb-1"><span>{step.l}</span><span>{step.v} ({pct}%)</span></div><div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:.8}} className={`h-full ${step.c} rounded-full`}/></div></div>)})}</div>;})()}
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.5}} className="card p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search phone or name..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} className="input ps-10" />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={filters.status} onChange={e=>{setFilters(f=>({...f,status:e.target.value}));setPage(1);}} className="select w-40">
              <option value="">All Statuses</option>{Object.entries(STATUS).map(([k,c])=><option key={k} value={k}>{c.label}</option>)}
            </select>
            <select value={filters.serviceInterest} onChange={e=>{setFilters(f=>({...f,serviceInterest:e.target.value}));setPage(1);}} className="select w-40">
              <option value="">All Services</option>{Object.entries(SERVICE).map(([k,c])=><option key={k} value={k}>{c.label}</option>)}
            </select>
            <select value={filters.tenantType} onChange={e=>{setFilters(f=>({...f,tenantType:e.target.value}));setPage(1);}} className="select w-44">
              {TENANT_TYPES.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {filterCount>0&&<button onClick={()=>{setFilters({status:'',serviceInterest:'',tenantType:''});setPage(1);}} className="btn btn-ghost text-xs"><X className="w-3 h-3"/> Clear</button>}
          </div>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.55}} className="card">
        {isLoading?(
          <div className="p-8 text-center"><div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"/></div>
        ):(
          <>
            <div className="table-container rounded-none border-0">
              <table className="table">
                <thead><tr>
                  <th>Phone / Name</th><th>Status</th><th>Service</th><th>Tenant Type</th><th>City</th><th>Notes</th><th>Created</th><th className="text-right">Actions</th>
                </tr></thead>
                <tbody>
                  {data?.leads?.map(lead=>{
                    const sc=STATUS[lead.status]||STATUS.new, Si=sc.icon, se=SERVICE[lead.serviceInterest]||SERVICE.none;
                    return (
                      <tr key={lead._id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-white font-bold text-xs">{lead.name?.[0]||lead.phoneNumber?.slice(-2)||'?'}</div>
                            <div><p className="font-bold text-gray-900 dark:text-white">{lead.name||'—'}</p><p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3"/>{lead.phoneNumber}</p></div>
                          </div>
                        </td>
                        <td><span className={`badge ${sc.color}`}><Si className="w-3 h-3 me-1"/>{sc.label}</span></td>
                        <td><span className="text-xs font-bold text-gray-500 px-2 py-1 rounded-md bg-gray-50 dark:bg-dark-700">{se.label}</span></td>
                        <td><span className="text-xs font-medium text-gray-600">{lead.tenantType ? (tenantLabelMap[lead.tenantType] || lead.tenantType) : '—'}</span></td>
                        <td><span className="text-xs font-medium text-gray-600">{lead.city||'—'}</span></td>
                        <td><p className="text-xs text-gray-500 max-w-[200px] truncate">{lead.notes||'—'}</p></td>
                        <td className="text-gray-500 text-xs">{formatSubscriptionDate(lead.createdAt, language)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {lead.status!=='interested'&&<button onClick={()=>quickM.mutate({id:lead._id,status:'interested'})} title="Interested" className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-500 transition-colors"><ThumbsUp className="w-3.5 h-3.5"/></button>}
                            {lead.status!=='not_interested'&&<button onClick={()=>quickM.mutate({id:lead._id,status:'not_interested'})} title="Not Interested" className="p-1.5 rounded-lg hover:bg-rose-50 text-gray-400 hover:text-rose-500 transition-colors"><ThumbsDown className="w-3.5 h-3.5"/></button>}
                            {lead.status!=='follow_up'&&<button onClick={()=>quickM.mutate({id:lead._id,status:'follow_up'})} title="Follow Up" className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-500 transition-colors"><PhoneCall className="w-3.5 h-3.5"/></button>}
                            {/* Send Demo */}
                            <button
                              onClick={()=>openDemoModal(lead)}
                              title="Send Demo Message"
                              className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                            >
                              <Send className="w-3.5 h-3.5"/>
                            </button>
                            <div className="w-px h-4 bg-gray-200 mx-1"/>
                            <button onClick={()=>openModal(lead)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"><Monitor className="w-3.5 h-3.5"/></button>
                            <button onClick={()=>{if(window.confirm('Delete?'))deleteM.mutate(lead._id);}} className="p-1.5 rounded-lg hover:bg-rose-50 text-gray-400 hover:text-rose-500 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {data?.leads?.length===0&&<tr><td colSpan="8" className="text-center py-12 text-gray-400"><Phone className="w-10 h-10 mx-auto mb-3 opacity-30"/><p className="font-bold">No leads yet</p><p className="text-xs">Add your first lead to get started</p></td></tr>}
                </tbody>
              </table>
            </div>
            {data?.pagination&&<div className="p-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">Showing {data.leads.length} of {data.pagination.total}</p>
              <div className="flex gap-2">
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="btn btn-secondary text-xs">Previous</button>
                <button onClick={()=>setPage(p=>p+1)} disabled={page>=data.pagination.pages} className="btn btn-secondary text-xs">Next</button>
              </div>
            </div>}
          </>
        )}
      </motion.div>

      {/* ── Send Demo Modal ── */}
      <SuperAdminPortal>
      <AnimatePresence>
        {demoLead&&(
          <motion.div
            className={`fixed inset-0 ${SA_MODAL_Z} flex items-center justify-center p-4`}
            onClick={()=>setDemoLead(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-white dark:bg-dark-800 rounded-[2rem] shadow-[0_25px_80px_-12px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-700 via-green-600 to-emerald-600"/>
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/[0.04] rounded-full -translate-y-1/2 translate-x-1/2"/>
                <div className="relative flex items-center justify-between px-7 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                      <Send className="w-5 h-5 text-white"/>
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white tracking-tight">Send Demo</h3>
                      <p className="text-xs text-white/60 font-semibold mt-0.5">
                        {demoLead.name || demoLead.phoneNumber}
                      </p>
                    </div>
                  </div>
                  <button onClick={()=>setDemoLead(null)} className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all border border-white/10">
                    <X className="w-4 h-4"/>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 overflow-y-auto bg-gray-50/50 dark:bg-dark-800">

                {/* Language selector */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-4 h-4 text-green-600"/>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Message Language</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {LANG_PAIRS.map(lp=>(
                      <button
                        key={lp.value}
                        onClick={()=>setDemoForm(f=>({...f,langPair:lp.value}))}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all ${
                          demoForm.langPair===lp.value
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 shadow-sm'
                            : 'border-gray-100 dark:border-dark-600 bg-white dark:bg-dark-700 hover:border-green-200'
                        }`}
                      >
                        <span className="text-2xl">{lp.flag}</span>
                        <div className="flex-1">
                          <p className={`text-sm font-bold ${demoForm.langPair===lp.value ? 'text-green-700 dark:text-green-400' : 'text-gray-800 dark:text-white'}`}>{lp.label}</p>
                          <p className="text-xs text-gray-400">{lp.desc}</p>
                        </div>
                        {demoForm.langPair===lp.value&&(
                          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white"/>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Credentials (optional override) */}
                <div className="bg-white dark:bg-dark-700 rounded-3xl p-5 border border-gray-100 dark:border-dark-600 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="w-4 h-4 text-blue-500"/>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Login Credentials</p>
                    <span className="text-[10px] text-gray-400 font-normal ml-1">(optional override)</span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1.5">
                      <Link className="w-3 h-3 inline mr-1"/>Login URL
                    </label>
                    <input
                      type="text"
                      value={demoForm.loginUrl}
                      onChange={e=>setDemoForm(f=>({...f,loginUrl:e.target.value}))}
                      placeholder="https://maqder.com/login"
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-dark-800 border border-gray-100 dark:border-dark-600 rounded-xl text-sm font-medium text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-400/30 focus:border-green-400 transition"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1.5">
                        <Mail className="w-3 h-3 inline mr-1"/>Email
                      </label>
                      <input
                        type="email"
                        value={demoForm.email}
                        onChange={e=>setDemoForm(f=>({...f,email:e.target.value}))}
                        placeholder="demo@maqder.com"
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-dark-800 border border-gray-100 dark:border-dark-600 rounded-xl text-sm font-medium text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-400/30 focus:border-green-400 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1.5">
                        <Lock className="w-3 h-3 inline mr-1"/>Password
                      </label>
                      <input
                        type="text"
                        value={demoForm.password}
                        onChange={e=>setDemoForm(f=>({...f,password:e.target.value}))}
                        placeholder="Demo@1234"
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-dark-800 border border-gray-100 dark:border-dark-600 rounded-xl text-sm font-medium text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-400/30 focus:border-green-400 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Preview hint */}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-2xl px-4 py-3 flex items-start gap-2.5">
                  <Send className="w-4 h-4 text-green-600 mt-0.5 shrink-0"/>
                  <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed">
                    A bilingual WhatsApp message will be sent to <strong>{demoLead.phoneNumber}</strong> with the login link, email and password in <strong>{LANG_PAIRS.find(l=>l.value===demoForm.langPair)?.label}</strong>.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 py-5 bg-white dark:bg-dark-800 border-t border-gray-100 dark:border-dark-700">
                <button type="button" onClick={()=>setDemoLead(null)} className="px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-sm rounded-2xl transition-all border border-gray-100">Cancel</button>
                <button
                  onClick={handleSendDemo}
                  disabled={sendDemoM.isPending}
                  className="px-7 py-2.5 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-green-600/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {sendDemoM.isPending
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                    : <><Send className="w-4 h-4"/> Send on WhatsApp</>
                  }
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lead Edit/Create Modal */}
      <AnimatePresence>
        {showModal&&(
          <motion.div
            className={`fixed inset-0 ${SA_MODAL_Z} flex items-center justify-center p-4`}
            onClick={closeModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl max-h-[92vh] bg-white dark:bg-dark-800 rounded-[2rem] shadow-[0_25px_80px_-12px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-800"/>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.03] rounded-full -translate-y-1/2 translate-x-1/2"/>
              <div className="relative flex items-center justify-between px-8 py-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                    <Phone className="w-6 h-6 text-white"/>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tight">{editingLead?'Edit Lead':'New Lead'}</h3>
                    <p className="text-xs text-white/50 font-bold uppercase tracking-widest mt-0.5">{editingLead?'Update query details':'Capture a new customer query'}</p>
                  </div>
                </div>
                <button onClick={closeModal} className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all border border-white/10">
                  <X className="w-5 h-5"/>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-gray-50/50 dark:bg-dark-800">
              {/* Contact Section */}
              <div className="bg-white dark:bg-dark-700 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-dark-600 space-y-5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-5 rounded-full bg-emerald-500"/>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Contact Info</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5">Phone Number <span className="text-rose-400">*</span></label>
                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-emerald-500 transition-colors"/>
                      <input type="tel" value={form.phoneNumber} onChange={e=>setForm(f=>({...f,phoneNumber:e.target.value}))} placeholder="+966 5x xxx xxxx" className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-300 transition-all dark:bg-dark-800 dark:border-dark-600 dark:text-white" autoFocus/>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5">Customer Name</label>
                    <input type="text" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Full name" className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-300 transition-all dark:bg-dark-800 dark:border-dark-600 dark:text-white"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5">City</label>
                    <input type="text" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} placeholder="e.g. Riyadh, Jeddah" className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-300 transition-all dark:bg-dark-800 dark:border-dark-600 dark:text-white"/>
                  </div>
                </div>
              </div>

              {/* Categorization Section */}
              <div className="bg-white dark:bg-dark-700 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-dark-600 space-y-5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-5 rounded-full bg-blue-500"/>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Categorization</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5">Status</label>
                    <div className="relative">
                      <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-300 transition-all appearance-none cursor-pointer dark:bg-dark-800 dark:border-dark-600 dark:text-white">
                        {Object.entries(STATUS).map(([k,c])=><option key={k} value={k}>{c.label}</option>)}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <div className={`w-2.5 h-2.5 rounded-full ${(STATUS[form.status]||STATUS.new).color.split(' ')[0].replace('bg-','bg-')}`} style={{backgroundColor:form.status==='interested'?'#10b981':form.status==='not_interested'?'#ef4444':form.status==='converted'?'#8b5cf6':form.status==='follow_up'?'#f59e0b':form.status==='attended'?'#3b82f6':'#64748b'}}/>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5">Service Interest</label>
                    <select value={form.serviceInterest} onChange={e=>setForm(f=>({...f,serviceInterest:e.target.value}))} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-300 transition-all appearance-none cursor-pointer dark:bg-dark-800 dark:border-dark-600 dark:text-white">
                      {Object.entries(SERVICE).map(([k,c])=><option key={k} value={k}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5">Tenant Type</label>
                    <select value={form.tenantType} onChange={e=>setForm(f=>({...f,tenantType:e.target.value}))} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-300 transition-all appearance-none cursor-pointer dark:bg-dark-800 dark:border-dark-600 dark:text-white">
                      {TENANT_TYPES.filter(o=>o.value).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div className="bg-white dark:bg-dark-700 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-dark-600">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-5 rounded-full bg-amber-500"/>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Notes & History</h4>
                </div>
                
                <div className="space-y-6">
                  {/* Main Notes - Always editable */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5">Main Notes / Requirements</label>
                    <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={3} placeholder="Conversation details, requirements..." className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-300 transition-all resize-none dark:bg-dark-800 dark:border-dark-600 dark:text-white"/>
                  </div>

                  {/* Note History - Only shown when editing */}
                  {editingLead && (
                    <div className="pt-4 border-t border-gray-100 dark:border-dark-600">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Follow-up History</label>
                      
                      {editingLead.noteHistory && editingLead.noteHistory.length > 0 ? (
                        <div className="mb-4 space-y-3 max-h-48 overflow-y-auto pr-2">
                          {editingLead.noteHistory.map((n, i) => (
                            <div key={i} className="p-3 bg-gray-50 dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-600">
                              <p className="text-[10px] font-bold text-gray-400 mb-1">{new Date(n.date).toLocaleString()}</p>
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{n.note}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic mb-4">No follow-up history yet.</p>
                      )}
                      
                      <textarea value={form.newNote} onChange={e=>setForm(f=>({...f,newNote:e.target.value}))} rows={2} placeholder="Add a new follow-up note..." className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-300 transition-all resize-none dark:bg-dark-800 dark:border-dark-600 dark:text-white"/>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-8 py-6 bg-white dark:bg-dark-800 border-t border-gray-100 dark:border-dark-700">
              <button type="button" onClick={closeModal} className="px-6 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-sm rounded-2xl transition-all border border-gray-100 hover:border-gray-200">Cancel</button>
              <button onClick={handleSubmit} disabled={createM.isPending||updateM.isPending} className="px-8 py-3 bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-emerald-700/20 hover:shadow-xl hover:shadow-emerald-700/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {createM.isPending||updateM.isPending?<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<><Save className="w-4 h-4"/>{editingLead?'Update Lead':'Save Lead'}</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>
      </SuperAdminPortal>
    </div>
  );
}
