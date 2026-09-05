import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Mirrors the paths entry in tsconfig.app.json; both have to agree or
  // the build and the editor disagree about the same import.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Prompt rather than autoUpdate: a silent swap reloads the page, and the
      // quick-add form is exactly where losing half-typed input would hurt.
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Mynt — collection de pièces euro',
        short_name: 'Mynt',
        description:
          'Gérez votre collection de pièces euro et retrouvez où chaque pièce est rangée.',
        // The manifest is static and cannot go through i18n, so this is the one
        // place a displayed string lives in a config file.
        lang: 'fr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#faf8f5',
        theme_color: '#faf8f5',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The build, including the self-hosted Inter files: a font served from
        // a CDN would vanish in the cellar.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Deliberately no runtime caching of the Supabase API. Data lives in the
        // persisted TanStack Query cache; a second cache in the service worker
        // would be a competing source of truth that can disagree with it.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//],
      },
      devOptions: { enabled: false },
    }),
  ],
})
