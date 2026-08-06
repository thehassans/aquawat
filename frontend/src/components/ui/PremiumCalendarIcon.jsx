import React from 'react';

/**
 * PremiumCalendarIcon
 * Ultra-premium, Apple & Linear inspired vector calendar icon with dynamic live date,
 * glossy metallic ring binders, crisp typography, and refined shadows.
 */
export default function PremiumCalendarIcon({
  date = new Date(),
  size = 'md', // 'xs' (20px), 'sm' (28px), 'md' (40px), 'lg' (48px), 'xl' (64px), '2xl' (80px)
  className = '',
  showLiveDate = true,
  animateOnHover = true,
}) {
  const parsedDate = date instanceof Date ? date : new Date(date || Date.now());
  const dayName = parsedDate.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
  const dayNumber = parsedDate.getDate();

  // Size configurations
  const sizeMap = {
    xs: {
      box: 'w-5 h-5 rounded-[5px]',
      header: 'h-[6px]',
      dayText: 'text-[4px]',
      numText: 'text-[9px] font-black',
      ringSize: 'w-[2px] h-[3px] -top-[1.5px]',
      ringGap: 'gap-[6px]',
    },
    sm: {
      box: 'w-7 h-7 rounded-[7px]',
      header: 'h-[8px]',
      dayText: 'text-[5.5px] tracking-wider',
      numText: 'text-[12px] font-black',
      ringSize: 'w-[2.5px] h-[4px] -top-[2px]',
      ringGap: 'gap-[9px]',
    },
    md: {
      box: 'w-10 h-10 rounded-[10px]',
      header: 'h-[12px]',
      dayText: 'text-[7px] tracking-widest font-black',
      numText: 'text-[16px] font-black',
      ringSize: 'w-[3px] h-[5px] -top-[2.5px]',
      ringGap: 'gap-[13px]',
    },
    lg: {
      box: 'w-12 h-12 rounded-[12px]',
      header: 'h-[14px]',
      dayText: 'text-[8px] tracking-widest font-black',
      numText: 'text-[20px] font-black',
      ringSize: 'w-[3.5px] h-[6px] -top-[3px]',
      ringGap: 'gap-[16px]',
    },
    xl: {
      box: 'w-16 h-16 rounded-[16px]',
      header: 'h-[18px]',
      dayText: 'text-[10px] tracking-widest font-black',
      numText: 'text-[26px] font-black',
      ringSize: 'w-[4.5px] h-[8px] -top-[4px]',
      ringGap: 'gap-[22px]',
    },
    '2xl': {
      box: 'w-20 h-20 rounded-[20px]',
      header: 'h-[23px]',
      dayText: 'text-[12px] tracking-widest font-black',
      numText: 'text-[32px] font-black',
      ringSize: 'w-[6px] h-[10px] -top-[5px]',
      ringGap: 'gap-[28px]',
    },
  };

  const s = sizeMap[size] || sizeMap.md;

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-between bg-white dark:bg-dark-900 border border-gray-200/90 dark:border-dark-600 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden flex-shrink-0 transition-transform duration-200 ${
        animateOnHover ? 'hover:scale-105 hover:shadow-[0_4px_14px_rgba(225,29,72,0.18)]' : ''
      } ${s.box} ${className}`}
      style={{
        userSelect: 'none',
      }}
    >
      {/* Metallic Chrome Ring Binders */}
      <div className={`absolute left-0 right-0 flex justify-center ${s.ringGap} z-20 pointer-events-none`}>
        <div
          className={`${s.ringSize} rounded-full bg-gradient-to-b from-gray-300 via-gray-100 to-gray-400 dark:from-gray-500 dark:to-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.3)] border border-gray-400/40`}
        />
        <div
          className={`${s.ringSize} rounded-full bg-gradient-to-b from-gray-300 via-gray-100 to-gray-400 dark:from-gray-500 dark:to-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.3)] border border-gray-400/40`}
        />
      </div>

      {/* Top Banner (Vibrant Crimson Red Gradient) */}
      <div
        className={`w-full bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 text-white flex items-center justify-center ${s.header} z-10 shadow-[0_1px_2px_rgba(0,0,0,0.15)]`}
      >
        <span className={`uppercase font-black leading-none drop-shadow-2xs ${s.dayText}`}>
          {showLiveDate ? dayName : 'CAL'}
        </span>
      </div>

      {/* Date Number Center */}
      <div className="w-full flex-1 flex items-center justify-center bg-gradient-to-b from-white to-slate-50 dark:from-dark-900 dark:to-dark-800">
        <span
          className={`leading-none text-gray-900 dark:text-white tracking-tight ${s.numText}`}
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, Roboto, sans-serif',
          }}
        >
          {showLiveDate ? dayNumber : '31'}
        </span>
      </div>

      {/* Glossy Overlay Highlight */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/5 pointer-events-none z-10" />
    </div>
  );
}
