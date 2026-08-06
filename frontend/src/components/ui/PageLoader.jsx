import React from 'react'

/**
 * Ultra-Responsive, Non-Blocking Page Skeleton Loader.
 * Seamlessly matches both Light and Dark themes with zero layout shifts
 * and zero full-screen takeover flashes.
 */
export default function PageLoader() {
  return (
    <div className="w-full animate-fade-in space-y-5">
      {/* Sleek Top Shimmer Bar */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-pulse z-50 shadow-sm" />

      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100 dark:border-dark-700">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse" />
          <div className="h-4 w-72 bg-gray-100 dark:bg-dark-800 rounded-md animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse" />
          <div className="h-9 w-24 bg-emerald-100 dark:bg-emerald-950/40 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Metric Cards Skeleton Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700/60 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
              <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-dark-700 animate-pulse" />
            </div>
            <div className="h-7 w-32 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse" />
            <div className="h-3 w-20 bg-gray-100 dark:bg-dark-700 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div className="p-6 rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700/60 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-700">
          <div className="h-5 w-36 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
          <div className="h-8 w-44 bg-gray-100 dark:bg-dark-700 rounded-lg animate-pulse" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex items-center gap-4 py-2.5">
              <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-dark-700 shrink-0 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                <div className="h-3 w-1/4 bg-gray-100 dark:bg-dark-800 rounded animate-pulse" />
              </div>
              <div className="h-4 w-16 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
              <div className="h-6 w-20 bg-gray-100 dark:bg-dark-700 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
