import React, { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { QrCode, LogOut, RefreshCw, Smartphone, CheckCircle, Download, Users } from 'lucide-react';
import api from '../../lib/api';

export default function WhatsAppConnect({ variant = 'compact' }) {
  const { language } = useSelector((state) => state.ui);
  const isSetup = variant === 'setup';

  const { data: statusData, refetch, isLoading } = useQuery({
    queryKey: ['whatsapp-client-status'],
    queryFn: () => api.get('/whatsapp/client/status').then(r => r.data),
    refetchInterval: (query) => {
      const currentData = query?.state?.data;
      if (currentData?.status === 'INITIALIZING' || currentData?.status === 'QR_READY') return 2000;
      return false;
    }
  });

  const initMutation = useMutation({
    mutationFn: () => api.post('/whatsapp/client/init').then(r => r.data),
    onSuccess: () => refetch()
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.post('/whatsapp/client/logout').then(r => r.data),
    onSuccess: () => refetch()
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post('/whatsapp/client/sync-contacts').then(r => r.data),
    onSuccess: () => {
      refetch();
      window.dispatchEvent(new CustomEvent('whatsapp-contacts-synced'));
    }
  });

  const exportContacts = (format = 'csv', type = 'all') => {
    const url = `/whatsapp/contacts/export?format=${format}&type=${type}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `whatsapp-contacts.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const status = statusData?.status || 'DISCONNECTED';
  const qrCode = statusData?.qrCode;
  const errorMsg = statusData?.error || (initMutation.isError ? (initMutation.error?.userMessage || initMutation.error?.message || 'API Error') : null);
  const startedRef = React.useRef(false);

  useEffect(() => {
    if (!isSetup || isLoading || startedRef.current) return;
    if (status === 'DISCONNECTED') {
      startedRef.current = true;
      initMutation.mutate();
    }
  }, [isSetup, isLoading, status, initMutation]);

  if (isSetup) {
    return (
      <div className="px-2 py-2">
        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMsg}
          </div>
        )}
        {isLoading || status === 'INITIALIZING' || initMutation.isPending ? (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-slate-500">
            <RefreshCw className="h-5 w-5 animate-spin text-emerald-700" />
            {language === 'ar' ? 'جاري تجهيز رمز QR…' : 'Preparing your QR code…'}
          </div>
        ) : status === 'READY' || status === 'CONNECTED' ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle className="h-6 w-6" />
            </div>
            <p className="text-base font-semibold text-slate-900">{language === 'ar' ? 'تم ربط الجوال' : 'Phone linked'}</p>
            <p className="text-sm text-slate-500">{language === 'ar' ? 'يمكنك فتح صندوق الوارد الآن.' : 'You can open the inbox now.'}</p>
            <div className="mt-2 flex items-center gap-2">
              <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                {syncMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : (language === 'ar' ? 'مزامنة جهات الاتصال' : 'Sync contacts')}
              </button>
              <button onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending} className="rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50">
                {language === 'ar' ? 'فصل' : 'Disconnect'}
              </button>
            </div>
          </div>
        ) : status === 'QR_READY' && qrCode ? (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {language === 'ar' ? 'في انتظار المسح…' : 'Waiting for scan…'}
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <img src={qrCode} alt="WhatsApp QR" className="h-56 w-56" />
            </div>
            <button onClick={() => refetch()} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700">
              <RefreshCw className="h-3.5 w-3.5" />
              {language === 'ar' ? 'تحديث الرمز' : 'Refresh code'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => initMutation.mutate()}
            disabled={initMutation.isPending}
            className="mx-auto flex items-center gap-2 rounded-2xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white"
          >
            {initMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            {language === 'ar' ? 'توليد رمز QR' : 'Generate QR code'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      {errorMsg && (
        <div className="mb-3 p-2 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs">
          {errorMsg}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <RefreshCw className="w-3 h-3 animate-spin" />
          {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
        </div>
      ) : status === 'READY' || status === 'CONNECTED' ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs font-medium text-green-700 dark:text-green-400">
              {language === 'ar' ? 'متصل' : 'Connected'}
            </span>
            {syncMutation.isSuccess && (
              <span className="text-[10px] text-green-600">
                {syncMutation.data?.individuals || 0} · {syncMutation.data?.groups || 0}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              title={language === 'ar' ? 'مزامنة' : 'Sync'}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-green-600 transition-colors"
            >
              {syncMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Users className="w-3 h-3" />}
            </button>
            <button
              onClick={() => exportContacts('csv', 'all')}
              title={language === 'ar' ? 'تصدير' : 'Export'}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-blue-600 transition-colors"
            >
              <Download className="w-3 h-3" />
            </button>
            <button
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              title={language === 'ar' ? 'فصل' : 'Disconnect'}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : status === 'QR_READY' && qrCode ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
            <span className="text-xs text-amber-600 font-medium">
              {language === 'ar' ? 'في انتظار المسح...' : 'Waiting for scan...'}
            </span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-gray-200 mx-auto w-fit">
            <img src={qrCode} alt="QR" className="w-40 h-40" />
          </div>
          <button onClick={() => refetch()} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mx-auto">
            <RefreshCw className="w-3 h-3" />
            {language === 'ar' ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => initMutation.mutate()}
          disabled={initMutation.isPending || status === 'INITIALIZING'}
          className="flex items-center gap-2 text-xs font-medium text-green-600 hover:text-green-700 transition-colors"
        >
          {initMutation.isPending || status === 'INITIALIZING' ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Smartphone className="w-3 h-3" />
          )}
          {language === 'ar' ? 'ربط واتساب' : 'Connect WhatsApp'}
        </button>
      )}
    </div>
  );
}
