import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devPort = Number(env.VITE_DEV_PORT || 5173)
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:5000'
  const cdn = String(env.VITE_CDN_URL || '').trim()
  const base = cdn ? (cdn.endsWith('/') ? cdn : `${cdn}/`) : '/'
  const isProd = mode === 'production'

  return {
    base,
    plugins: [
      react(),
    ],

    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },

    // ─── Build optimizations ──────────────────────────────────────────────────
    build: {
      // No source maps in production — speeds up build & keeps bundle size down
      sourcemap: false,

      // CSS code splitting: each async chunk gets its own CSS file, so users
      // only download styles for the routes they actually visit
      cssCodeSplit: true,

      // Terser for maximum dead-code elimination
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: isProd,
          drop_debugger: isProd,
          passes: 2,           // 2-pass compression catches more dead code
          pure_funcs: isProd ? ['console.log', 'console.info', 'console.debug'] : [],
        },
        mangle: { safari10: true },
        format: { comments: false },
      },

      rollupOptions: {
        output: {
          // Module preload polyfill — browsers prefetch critical chunks
          // automatically, reducing waterfall depth on first visit
          generatedCode: { symbols: false },

          manualChunks(id) {
            // ── Core React runtime ──────────────────────────────────────────
            if (id.includes('node_modules/react/') ||
                id.includes('node_modules/react-dom/') ||
                id.includes('node_modules/react-router-dom/') ||
                id.includes('node_modules/scheduler/')) {
              return 'react-vendor';
            }
            // ── State management ────────────────────────────────────────────
            if (id.includes('@reduxjs/toolkit') || id.includes('react-redux') || id.includes('immer')) {
              return 'redux-vendor';
            }
            // ── Server state / async data fetching ─────────────────────────
            if (id.includes('@tanstack/react-query')) return 'query-vendor';
            // ── UI primitives ───────────────────────────────────────────────
            if (id.includes('lucide-react')) return 'ui-vendor';
            if (id.includes('framer-motion')) return 'motion-vendor';
            if (id.includes('react-hot-toast')) return 'toast-vendor';
            // ── Charts — lazy-loaded, large ─────────────────────────────────
            if (id.includes('recharts') || id.includes('d3-')) return 'chart-vendor';
            // ── HTTP client ─────────────────────────────────────────────────
            if (id.includes('axios')) return 'axios-vendor';
            // ── Forms ───────────────────────────────────────────────────────
            if (id.includes('react-hook-form') || id.includes('@hookform')) return 'form-vendor';
            // ── Date utilities — heavy, only loaded when needed ─────────────
            if (id.includes('date-fns')) return 'date-vendor';
            // ── PDF generation — large, on-demand ──────────────────────────
            if (id.includes('jspdf')) return 'pdf-vendor';
            // ── Spreadsheet — large, on-demand ─────────────────────────────
            if (id.includes('xlsx')) return 'xlsx-vendor';
            // ── QR code ─────────────────────────────────────────────────────
            if (id.includes('qrcode')) return 'qr-vendor';
            // ── Radix UI ────────────────────────────────────────────────────
            if (id.includes('@radix-ui')) return 'radix-vendor';
            // ── IndexedDB / idb ─────────────────────────────────────────────
            if (id.includes('/idb/')) return 'idb-vendor';
            if (id.includes('socket.io-client')) return 'socket-vendor';
            if (id.includes('react-select')) return 'select-vendor';
            // ── Virtual scrolling ───────────────────────────────────────────────
            if (id.includes('react-window')) return 'ui-vendor';
            // ── Built-in translator ─────────────────────────────────────
            if (id.includes('builtInTranslator')) return 'translator-vendor';
          },
        },
      },

      chunkSizeWarningLimit: 600,
    },

    // ─── Module preload — polyfill ensures chunk prefetching works in all browsers
    modulePreload: {
      polyfill: true,
    },

    // ─── Dev server ───────────────────────────────────────────────────────────
    server: {
      host: '0.0.0.0',
      port: Number.isFinite(devPort) && devPort > 0 ? devPort : 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
