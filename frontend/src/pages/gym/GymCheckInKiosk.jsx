import React, { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Search,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Users,
  Dumbbell,
  ShieldCheck,
  Clock,
  Sparkles
} from 'lucide-react';
import api from '../../lib/api';
import { useTranslation } from '../../lib/translations';

// Web Audio API chimes for instant zero-latency sound feedback
function playSound(type = 'success') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      // Pleasant high-pitch double chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else {
      // Low buzz for denied
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch (e) {
    // AudioContext suppressed or not permitted
  }
}

export default function GymCheckInKiosk() {
  const { language } = useSelector((state) => state.ui);
  const tenant = useSelector((state) => state.auth?.tenant || state.auth?.user?.tenant);
  const isAr = language === 'ar';
  const { t } = useTranslation(language);

  const [scanInput, setScanInput] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const inputRef = useRef(null);

  // Keep input focused constantly for hardware barcode/RFID scanners
  useEffect(() => {
    const focusInterval = setInterval(() => {
      if (document.activeElement !== inputRef.current && !document.querySelector('button:focus')) {
        inputRef.current?.focus();
      }
    }, 1500);
    return () => clearInterval(focusInterval);
  }, []);

  const checkInMutation = useMutation({
    mutationFn: (scanData) => api.post('/gym/check-in', { scanData }),
    onSuccess: (res) => {
      const result = res.data;
      setLastResult(result);
      if (soundEnabled) {
        playSound(result.granted ? 'success' : 'denied');
      }
      setScanInput('');
      // Auto-clear result after 6 seconds
      setTimeout(() => {
        setLastResult((prev) => (prev === result ? null : prev));
      }, 6000);
    },
    onError: (err) => {
      setLastResult({
        granted: false,
        message: err.response?.data?.error || 'Connection error / خطأ في الاتصال',
      });
      if (soundEnabled) playSound('denied');
      setScanInput('');
    },
  });

  const handleScanSubmit = (e) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    checkInMutation.mutate(scanInput.trim());
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between p-4 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white rounded-3xl relative overflow-hidden shadow-2xl">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 -start-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 -end-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* ── TOP KIOSK CONTROLS ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between relative z-10">
        <Link
          to="/app/dashboard/gym"
          className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 backdrop-blur-md transition"
        >
          <ArrowLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
          <span>{isAr ? 'العودة للوحة النادي' : 'Exit Kiosk'}</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition"
            title={soundEnabled ? 'Mute audio cues' : 'Enable audio cues'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── CENTER INTERACTIVE SCANNER / RESULT DISPLAY ────────────────────────── */}
      <div className="max-w-xl mx-auto w-full my-auto text-center space-y-6 relative z-10">
        <AnimatePresence mode="wait">
          {!lastResult ? (
            /* Idle Ready-To-Scan Mode */
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="w-24 h-24 mx-auto rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center ring-8 ring-emerald-500/10 animate-pulse">
                <QrCode className="w-12 h-12" />
              </div>

              <div>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {isAr ? 'امسح بطاقة العضوية أو الرمز' : 'Scan Member Pass'}
                </h2>
                <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
                  {isAr
                    ? 'ضع رمز QR أمام القارئ أو مرر بطاقة RFID أو ادخل رقم الجوال'
                    : 'Hold your digital QR pass in front of the scanner, tap RFID card, or enter phone number'}
                </p>
              </div>

              {/* High-speed Scan Input Form */}
              <form onSubmit={handleScanSubmit} className="max-w-md mx-auto relative">
                <input
                  ref={inputRef}
                  type="text"
                  autoFocus
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder={isAr ? 'امسح الباركود أو اكتب رقم العضوية / الجوال...' : 'Scan barcode or enter Member ID / Phone...'}
                  className="w-full px-5 py-4 rounded-2xl bg-white/10 border-2 border-emerald-500/50 text-white placeholder-slate-400 text-center font-mono text-base sm:text-lg focus:outline-none focus:ring-4 focus:ring-emerald-500/30 focus:border-emerald-400 backdrop-blur-md shadow-xl"
                />
                <button
                  type="submit"
                  disabled={checkInMutation.isPending}
                  className="mt-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold text-sm shadow-lg shadow-emerald-500/30 transition transform active:scale-95 w-full"
                >
                  {checkInMutation.isPending ? 'Verifying...' : isAr ? 'تسجيل الدخول' : 'Verify Access'}
                </button>
              </form>
            </motion.div>
          ) : lastResult.granted ? (
            /* ACCESS GRANTED (GREEN CARD) */
            <motion.div
              key="granted"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="p-8 rounded-3xl bg-gradient-to-br from-emerald-950/80 to-slate-900 border-2 border-emerald-500/80 shadow-2xl space-y-5"
            >
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 ring-8 ring-emerald-500/20">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase tracking-wider">
                  {isAr ? 'تم التصريح بالدخول' : 'Access Granted'}
                </span>
                <h2 className="text-3xl font-black text-white mt-3">
                  {isAr ? lastResult.member?.nameAr || lastResult.member?.nameEn : lastResult.member?.nameEn}
                </h2>
                <p className="text-xs font-mono text-emerald-400 mt-1 font-bold">
                  {lastResult.member?.memberNumber}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 text-xs">
                <div className="p-3 rounded-2xl bg-white/5">
                  <span className="text-slate-400 block text-[10px]">{isAr ? 'الباقة النشطة' : 'Active Plan'}</span>
                  <span className="font-bold text-white text-sm">{lastResult.subscription?.planId?.nameEn || 'Membership'}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/5">
                  <span className="text-slate-400 block text-[10px]">{isAr ? 'الأيام المتبقية' : 'Days Remaining'}</span>
                  <span className="font-bold text-emerald-400 font-mono text-sm">{lastResult.daysRemaining} {isAr ? 'يوم' : 'days'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLastResult(null)}
                className="px-6 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
              >
                {isAr ? 'العضو التالي' : 'Next Member'}
              </button>
            </motion.div>
          ) : (
            /* ACCESS DENIED (RED CARD) */
            <motion.div
              key="denied"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="p-8 rounded-3xl bg-gradient-to-br from-rose-950/80 to-slate-900 border-2 border-rose-500/80 shadow-2xl space-y-5"
            >
              <div className="w-20 h-20 mx-auto rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/40 ring-8 ring-rose-500/20">
                <XCircle className="w-10 h-10" />
              </div>

              <div>
                <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-black uppercase tracking-wider">
                  {isAr ? 'الدخول مرفوض' : 'Access Denied'}
                </span>
                <h2 className="text-2xl font-black text-white mt-3">
                  {lastResult.member ? (isAr ? lastResult.member.nameAr || lastResult.member.nameEn : lastResult.member.nameEn) : (isAr ? 'عضو غير مسجل' : 'Unknown Member')}
                </h2>
                <p className="text-xs text-rose-300 mt-2 font-medium">
                  {lastResult.message}
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setLastResult(null)}
                  className="px-6 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
                >
                  {isAr ? 'إعادة المحاولة' : 'Try Again'}
                </button>

                <Link
                  to="/app/dashboard/gym/members"
                  className="px-6 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20"
                >
                  {isAr ? 'تجديد الاشتراك بالاستقبال' : 'Renew at Front Desk'}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── FOOTER BRANDING ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-slate-500 relative z-10 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <Dumbbell className="w-4 h-4 text-emerald-400" />
          <span>{tenant?.name || 'Maqder Gym ERP'}</span>
        </div>
        <span className="font-mono text-[11px]">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>
    </div>
  );
}
