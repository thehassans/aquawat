import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Download, MapPin, Phone, Star, Building2, Globe, Database, Loader2, Target, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../lib/translations';
import { useSelector } from 'react-redux';
import api from '../../lib/api';
import * as XLSX from 'xlsx';

const BUSINESS_TYPES = ['trading', 'construction', 'travel_agency', 'restaurant', 'car_rental', 'laundry', 'saloon', 'khayyat', 'boutique', 'manpower', 'bakala', 'car_workshop', 'bookstore', 'ecommerce', 'furniture_shop'];

export default function LeadsGeneration() {
  const { language } = useSelector((state) => state.ui);
  const { t } = useTranslation(language);
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState([]);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  
  const [setups, setSetups] = useState([]);
  const [selectedContext, setSelectedContext] = useState(BUSINESS_TYPES[0]);

  useEffect(() => {
    const fetchSetups = async () => {
      try {
        const res = await api.get('/lead-setup');
        setSetups(res.data);
      } catch (err) {
        console.error('Failed to fetch lead setups', err);
      }
    };
    fetchSetups();
  }, []);

  const handleWhatsApp = (phone) => {
    if (!phone || phone === 'N/A') return;
    
    let text = '';
    const setup = setups.find(s => s.businessType === selectedContext);
    
    if (setup) {
      text = setup.message || '';
      if (setup.bannerImage) {
        const bannerUrl = setup.bannerImage.startsWith('http') ? setup.bannerImage : api.defaults.baseURL.replace('/api', '') + setup.bannerImage;
        text += `\n\n${bannerUrl}`;
      }
    }
    
    // Format phone to international if it starts with 05
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('05')) {
      cleanPhone = '966' + cleanPhone.substring(1);
    }

    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/${cleanPhone}?text=${encodedText}`, '_blank');
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setLeads([]);

    try {
      // Use a custom config to increase timeout to 60 seconds (since scraping takes time)
      // and add a custom header to bypass offline-queue logic if it fails.
      const res = await api.post('/leads/scrape', { query, maxResults: 1000 }, {
        timeout: 600000, // 10 minutes
        headers: { 'X-Skip-Offline-Queue': 'true' }
      });
      
      if (res.data.success && !res.data.offline) {
        setLeads(res.data.data || []);
        setSuccessMsg(language === 'ar' ? `تم استخراج ${res.data.count} نتيجة بنجاح` : `Successfully scraped ${res.data.count} leads`);
      } else if (res.data.offline) {
        setError(language === 'ar' ? 'حدث خطأ في الاتصال بالسيرفر' : 'Network error. Please try again.');
      } else {
        setError(res.data.message || 'Error occurred while scraping');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error occurred while scraping');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (leads.length === 0) return;
    
    const worksheet = XLSX.utils.json_to_sheet(leads);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
    XLSX.writeFile(workbook, `Leads_${query}_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 relative">
      {/* Decorative Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/70 dark:bg-dark-800/70 backdrop-blur-2xl p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/60 dark:border-white/10 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        <div className="absolute top-[-50%] right-[-10%] w-[40%] h-[200%] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-50%] left-[-10%] w-[40%] h-[200%] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 transform -rotate-6">
            <Target className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 tracking-tight">
              {language === 'ar' ? 'استخراج العملاء المحتملين' : 'Leads Generation Engine'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium text-sm">
              {language === 'ar' ? 'استخراج بيانات الشركات والمطاعم من الخرائط' : 'AI-powered scraper to extract business data from maps'}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleExport}
          disabled={leads.length === 0}
          className="relative z-10 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all hover:bg-gray-50 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5" />
          {language === 'ar' ? 'تصدير إكسيل' : 'Export Excel'}
        </button>
      </div>

      {/* Search Bar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-2xl p-4 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/60 dark:border-white/10 relative z-20">
        <form onSubmit={handleSearch} className="relative flex flex-col md:flex-row gap-4 items-center">
            <select
              value={selectedContext}
              onChange={(e) => setSelectedContext(e.target.value)}
              className="w-full md:w-64 bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm border-2 border-transparent rounded-[2rem] py-6 px-6 text-xl font-medium focus:bg-white dark:focus:bg-dark-900 focus:border-purple-500/30 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all shadow-inner text-gray-800 dark:text-gray-100"
            >
              {BUSINESS_TYPES.map(type => (
                <option key={type} value={type}>
                  {t(`businessTypes.${type}`, type.replace('_', ' ').toUpperCase())}
                </option>
              ))}
            </select>
            <div className="flex-1 relative w-full">
              <div className="absolute inset-y-0 start-8 flex items-center pointer-events-none">
                <Search className="h-6 w-6 text-indigo-400 group-focus-within:text-indigo-600 transition-colors" />
              </div>
              <input
                type="text"
                placeholder={language === 'ar' ? 'مطاعم في الرياض، فنادق في جدة...' : 'Restaurants in Riyadh, Hotels in Jeddah...'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
                className="w-full bg-gray-50/50 dark:bg-dark-900/50 border border-transparent rounded-[2rem] py-6 ps-20 pe-40 text-xl font-medium focus:bg-white dark:focus:bg-dark-900 focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-inner text-gray-800 dark:text-gray-100 placeholder-gray-400 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="absolute end-4 top-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] hover:bg-[position:right_center] text-white px-10 py-4 rounded-[1.5rem] font-bold text-lg shadow-[0_8px_20px_-6px_rgba(79,70,229,0.5)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {language === 'ar' ? 'البحث الآن' : 'Start Scraping'}
              </button>
            </div>
          </form>
      </motion.div>

      {/* Status Messages */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-2xl text-center font-semibold">
            {error}
          </motion.div>
        )}
        {successMsg && !loading && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center justify-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl text-center font-semibold border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-5 h-5" /> {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/60 dark:border-white/10 overflow-hidden min-h-[500px]">
        {loading ? (
          <div className="h-[400px] flex flex-col items-center justify-center gap-5 text-gray-400">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <Globe className="absolute inset-0 m-auto w-8 h-8 text-indigo-400 animate-pulse" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-gray-700 dark:text-gray-200 text-lg">{language === 'ar' ? 'جاري استخراج البيانات...' : 'Scraping Map Data...'}</h3>
              <p className="text-sm mt-1">{language === 'ar' ? 'هذا قد يستغرق بعض الوقت يرجى الانتظار' : 'This might take a minute, please be patient.'}</p>
            </div>
          </div>
        ) : leads.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-dark-900/80 border-b border-gray-100 dark:border-dark-700 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-black">
                  <th className="px-6 py-5 rounded-tl-3xl">{language === 'ar' ? 'الاسم' : 'Business Name'}</th>
                  <th className="px-6 py-5">{language === 'ar' ? 'رقم الهاتف' : 'Phone'}</th>
                  <th className="px-6 py-5">{language === 'ar' ? 'المدينة' : 'City'}</th>
                  <th className="px-6 py-5">{language === 'ar' ? 'التقييم' : 'Rating'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-dark-700/50">
                <AnimatePresence>
                  {leads.map((lead, idx) => (
                    <motion.tr 
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                      key={idx} 
                      className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-dark-700 dark:to-dark-600 flex items-center justify-center shadow-sm">
                            <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <span className="font-bold text-gray-900 dark:text-white text-sm">{lead.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center text-gray-500">
                            <Phone className="w-4 h-4 mr-2" />
                            {lead.phone}
                          </div>
                          {lead.phone && lead.phone !== 'N/A' && (
                            <button
                              onClick={() => handleWhatsApp(lead.phone)}
                              className="p-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                              title="Send WhatsApp Message"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12.031 0C5.385 0 0 5.385 0 12.032c0 2.13.553 4.195 1.603 6.012L.416 23.584l5.684-1.492A11.97 11.97 0 0012.031 24c6.646 0 12.031-5.385 12.031-12.032C24.062 5.385 18.677 0 12.031 0zm.019 22.015c-1.802 0-3.564-.485-5.112-1.402l-.367-.217-3.8.997 1.015-3.705-.238-.378a9.98 9.98 0 01-1.528-5.347c0-5.512 4.486-10 9.999-10 2.673 0 5.185 1.042 7.075 2.934a9.96 9.96 0 012.927 7.067c0 5.512-4.486 10-10.001 10h.03zm5.49-7.502c-.301-.151-1.782-.88-2.059-.98-.277-.101-.479-.151-.68.151-.201.302-.781.98-.957 1.18-.176.201-.352.227-.653.076-1.393-.656-2.5-1.442-3.416-2.92-.126-.201-.013-.315.138-.465.138-.138.301-.352.452-.529.151-.176.201-.301.301-.503.101-.201.05-.378-.025-.529-.076-.151-.68-1.64-.932-2.245-.246-.593-.497-.512-.68-.52-.176-.008-.378-.008-.579-.008-.201 0-.528.076-.805.378-.277.302-1.057 1.033-1.057 2.518 0 1.485 1.082 2.92 1.233 3.121.151.201 2.128 3.253 5.158 4.56.721.31 1.284.496 1.724.634.723.231 1.382.198 1.902.12.584-.088 1.782-.729 2.033-1.433.252-.704.252-1.309.176-1.433-.076-.126-.277-.201-.579-.352z"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-medium text-gray-600 dark:text-gray-300">
                          <MapPin className="w-3.5 h-3.5 text-red-400" /> 
                          <span className="capitalize">{lead.city}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-200 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg w-fit">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          {lead.rating}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-[400px] flex flex-col items-center justify-center text-gray-400">
            <Database className="w-16 h-16 mb-4 opacity-20" />
            <span className="font-semibold text-lg text-gray-500">{language === 'ar' ? 'ابدأ البحث لاستخراج البيانات' : 'Start a search to generate leads'}</span>
            <p className="text-sm mt-2 max-w-md text-center opacity-70">
              {language === 'ar' 
                ? 'قم بالبحث عن أي نوع من الأعمال أو الخدمات في أي مدينة للحصول على قائمة بالأسماء والأرقام' 
                : 'Search for any business category in any city to extract a list of names, phones, and ratings directly into an Excel sheet.'}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
