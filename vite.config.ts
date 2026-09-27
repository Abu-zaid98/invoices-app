import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // مسارات نسبية ليعمل التطبيق من أي مجلد (استضافة مشتركة/فرعية) لا الجذر فقط
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        id: './',
        name: 'فواتيري',
        short_name: 'فواتيري',
        description: 'فواتيري — إدارة فواتير الشراء والبيع — يعمل دون إنترنت وبياناتك محفوظة على جهازك',
        theme_color: '#0f1420',
        background_color: '#0f1420',
        display: 'standalone',
        orientation: 'portrait',
        scope: './',
        start_url: './',
        dir: 'rtl',
        lang: 'ar',
        categories: ['business', 'finance', 'utilities'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // IndexedDB محلي بطبيعته؛ نضمن عمل الواجهة دون إنترنت
        navigateFallbackDenylist: [/^\/api/],
        // قطعة html2canvas داخل jspdf (لدالة html() التي لا نستخدمها) — لا داعي لتخزينها
        globIgnores: ['**/html2canvas*'],
      }
    })
  ]
})
