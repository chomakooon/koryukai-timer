import { defineConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon-192.svg', 'icon-512.svg'],
            manifest: {
                name: '交流会進行アシスタント',
                short_name: '進行アシスタント',
                description: '交流会用のタイマー管理PWA。オフラインでも動作します。',
                theme_color: '#4f46e5',
                background_color: '#ffffff',
                display: 'standalone',
                orientation: 'portrait-primary',
                start_url: '/',
                icons: [
                    {
                        src: '/icon-192.svg',
                        sizes: '192x192',
                        type: 'image/svg+xml',
                        purpose: 'any maskable'
                    },
                    {
                        src: '/icon-512.svg',
                        sizes: '512x512',
                        type: 'image/svg+xml',
                        purpose: 'any maskable'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg}']
            }
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    assetsInclude: ['**/*.svg', '**/*.csv']
});
