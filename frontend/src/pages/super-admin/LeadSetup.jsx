import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Image as ImageIcon, Loader2, Target, CheckCircle2, Trash2 } from 'lucide-react';
import { useTranslation } from '../../lib/translations';
import { useSelector } from 'react-redux';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const BUSINESS_TYPES = ['trading', 'construction', 'travel_agency', 'restaurant', 'car_rental', 'laundry', 'saloon', 'khayyat', 'boutique', 'manpower', 'bakala', 'car_workshop', 'bookstore', 'ecommerce', 'furniture_shop'];

const LeadSetup = () => {
  const { t } = useTranslation();
  const { language } = useSelector((state) => state.ui);
  const isRTL = language === 'ar';

  const [setups, setSetups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [selectedType, setSelectedType] = useState(BUSINESS_TYPES[0]);
  const [message, setMessage] = useState('');
  const [bannerImage, setBannerImage] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');

  useEffect(() => {
    fetchSetups();
  }, []);

  const fetchSetups = async () => {
    try {
      setLoading(true);
      const res = await api.get('/lead-setup');
      setSetups(res.data);
      if (res.data.length > 0) {
        const defaultSetup = res.data.find(s => s.businessType === selectedType);
        if (defaultSetup) {
          setMessage(defaultSetup.message);
          setBannerPreview(defaultSetup.bannerImage);
        } else {
          setMessage('');
          setBannerPreview('');
        }
      }
    } catch (error) {
      toast.error(language === 'ar' ? 'فشل في جلب الإعدادات' : 'Failed to fetch setups');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type) => {
    setSelectedType(type);
    const existing = setups.find(s => s.businessType === type);
    if (existing) {
      setMessage(existing.message);
      setBannerPreview(existing.bannerImage);
    } else {
      setMessage('');
      setBannerPreview('');
    }
    setBannerImage(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBannerImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error(language === 'ar' ? 'الرسالة مطلوبة' : 'Message is required');
      return;
    }

    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('businessType', selectedType);
      formData.append('message', message);
      if (bannerImage) {
        formData.append('bannerImage', bannerImage);
      }

      await api.post('/lead-setup', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(language === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully');
      fetchSetups();
      setBannerImage(null);
    } catch (error) {
      toast.error(language === 'ar' ? 'فشل في الحفظ' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`p-6 max-w-7xl mx-auto space-y-8 relative ${isRTL ? 'text-right rtl' : 'text-left ltr'}`}>
      
      {/* Decorative Global Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header Panel */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2.5rem] bg-white/70 dark:bg-dark-800/70 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/60 dark:border-white/10 p-8 group"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        <div className="absolute top-[-50%] right-[-10%] w-[40%] h-[200%] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-50%] left-[-10%] w-[40%] h-[200%] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30 transform -rotate-6">
            <Target className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 tracking-tight">
              {language === 'ar' ? 'إعدادات استخراج العملاء' : 'Lead Setup'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium text-sm">
              {language === 'ar' ? 'تكوين رسائل واتساب وصور البانر لكل نشاط تجاري' : 'Configure WhatsApp messages and banner images for each business type'}
            </p>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4 relative z-10">
            <div className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/60 dark:border-white/10 p-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-6">
                {language === 'ar' ? 'اختر النشاط التجاري' : 'Select Business Type'}
              </h3>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {BUSINESS_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => handleTypeChange(type)}
                    className={`w-full flex items-center justify-between p-4 rounded-[1.5rem] transition-all duration-300 ${
                      selectedType === type
                        ? 'bg-purple-50/80 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 shadow-inner'
                        : 'bg-gray-50/50 dark:bg-dark-900/50 border border-transparent hover:bg-white dark:hover:bg-dark-700 hover:shadow-sm'
                    }`}
                  >
                    <span className={`font-semibold capitalize ${selectedType === type ? 'text-purple-700 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400'}`}>
                      {t(`businessTypes.${type}`, type.replace(/_/g, ' '))}
                    </span>
                    {setups.some(s => s.businessType === type) && (
                      <CheckCircle2 className={`w-5 h-5 ${selectedType === type ? 'text-purple-500' : 'text-emerald-500'}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2 relative z-10">
            <motion.form 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              key={selectedType}
              onSubmit={handleSave} 
              className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/60 dark:border-white/10 p-8 space-y-8"
            >
              <div className="border-b border-gray-100 dark:border-dark-700/50 pb-6 flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 capitalize">
                  {t(`businessTypes.${selectedType}`, selectedType.replace(/_/g, ' '))} Setup
                </h2>
                <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-4 py-1.5 rounded-full text-sm font-bold border border-purple-200 dark:border-purple-800/50">
                   Configuration
                </div>
              </div>

              {/* Message Input */}
              <div className="space-y-4">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                  {language === 'ar' ? 'رسالة واتساب الترويجية' : 'WhatsApp Promotional Message'}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={language === 'ar' ? 'اكتب رسالتك هنا...' : 'Type your message here...'}
                  className="w-full h-48 p-6 rounded-[2rem] bg-gray-50/50 dark:bg-dark-900/50 border border-transparent focus:bg-white dark:focus:bg-dark-900 focus:border-purple-500/30 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none resize-none shadow-inner text-gray-800 dark:text-gray-100 text-lg leading-relaxed"
                  required
                />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 px-2">
                  {language === 'ar' 
                    ? 'هذه هي الرسالة النصية التي سيتم تعبئتها مسبقاً عند النقر على واتساب في صفحة استخراج العملاء.' 
                    : 'This is the text message that will be pre-filled when clicking WhatsApp on the Leads Generation page.'}
                </p>
              </div>

              {/* Banner Upload */}
              <div className="space-y-4">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                  {language === 'ar' ? 'صورة البانر' : 'Banner Image'}
                </label>
                
                <div className="mt-2 flex justify-center rounded-[2rem] bg-gray-50/50 dark:bg-dark-900/50 border-2 border-dashed border-gray-300 dark:border-dark-600 px-6 py-12 hover:bg-gray-100/50 dark:hover:bg-dark-800/50 transition-colors relative overflow-hidden group shadow-inner">
                  {bannerPreview ? (
                    <div className="relative w-full flex justify-center">
                      <img src={bannerPreview.startsWith('http') || bannerPreview.startsWith('data:') ? bannerPreview : api.defaults.baseURL.replace('/api', '') + bannerPreview} alt="Banner" className="max-h-72 rounded-[1.5rem] object-contain shadow-lg" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-[1.5rem] backdrop-blur-sm">
                        <label className="cursor-pointer bg-white text-gray-900 px-6 py-3 rounded-full font-bold shadow-2xl hover:scale-105 transition-transform">
                          {language === 'ar' ? 'تغيير الصورة' : 'Change Image'}
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="w-20 h-20 mx-auto bg-white dark:bg-dark-800 rounded-full flex items-center justify-center shadow-sm mb-4">
                        <ImageIcon className="h-10 w-10 text-purple-400" aria-hidden="true" />
                      </div>
                      <div className="mt-4 flex text-base leading-6 text-gray-600 dark:text-gray-400 justify-center">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer rounded-md font-black text-purple-600 dark:text-purple-400 focus-within:outline-none hover:text-purple-500 transition-colors"
                        >
                          <span>{language === 'ar' ? 'رفع ملف' : 'Upload a file'}</span>
                          <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                        </label>
                        <p className="pl-2">{language === 'ar' ? 'أو سحب وإفلات' : 'or drag and drop'}</p>
                      </div>
                      <p className="text-sm leading-5 text-gray-500 dark:text-gray-500 mt-2">PNG, JPG, GIF up to 10MB</p>
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 px-2">
                  {language === 'ar'
                    ? 'سيتم إرفاق رابط الصورة هذه أسفل رسالة الواتساب ليتم عرضها كمعاينة للصورة.'
                    : 'The link to this image will be appended to the WhatsApp message to generate a preview thumbnail.'}
                </p>
              </div>

              {/* Actions */}
              <div className="pt-8 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-lg rounded-[1.5rem] shadow-[0_8px_20px_-6px_rgba(147,51,234,0.5)] transition-all transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  {saving ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Save className="w-6 h-6" />
                  )}
                  {language === 'ar' ? 'حفظ الإعدادات' : 'Save Setup'}
                </button>
              </div>

            </motion.form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadSetup;
