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
            // Fewer chunks = fewer round-trips on first paint (SaaS cold load)
            if (id.includes('node_modules/react/') ||
                id.includes('node_modules/react-dom/') ||
                id.includes('node_modules/react-router') ||
                id.includes('node_modules/scheduler/')) {
              return 'react-vendor'
            }
            if (id.includes('@reduxjs/toolkit') || id.includes('react-redux') || id.includes('immer')
                || id.includes('@tanstack/react-query') || id.includes('axios')) {
              return 'data-vendor'
            }
            if (id.includes('lucide-react') || id.includes('@radix-ui') || id.includes('framer-motion')
                || id.includes('react-hot-toast') || id.includes('react-select') || id.includes('react-window')) {
              return 'ui-vendor'
            }
            if (id.includes('recharts') || id.includes('d3-')) return 'chart-vendor'
            if (id.includes('jspdf')) return 'pdf-vendor'
            if (id.includes('xlsx')) return 'xlsx-vendor'
            if (id.includes('qrcode')) return 'qr-vendor'
            if (id.includes('date-fns')) return 'date-vendor'
            if (id.includes('/idb/') || id.includes('socket.io-client')) return 'offline-vendor'
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
