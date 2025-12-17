import { defineConfig } from "vite"
import react from "@vitejs/plugin-react-swc"
import path from "path"
import { componentTagger } from "lovable-tagger"
import { VitePWA } from "vite-plugin-pwa"

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt", "placeholder.svg"],
      manifest: {
        name: "ירון הרשברג - מספרה יוצאת דופן",
        short_name: "ירון הרשברג",
        description: "מערכת זימון תורים מותאים אישית",
        theme_color: "#3b82f6",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait-primary",
        dir: "rtl",
        lang: "he",
        start_url: "/",
        icons: [
          {
            src: "/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ],
        shortcuts: [
          {
            name: "זימון תור חדש",
            short_name: "תור חדש",
            description: "זימון תור חדש",
            url: "/setup-appointment",
            icons: [{ src: "/icon-192x192.png", sizes: "192x192" }]
          },
          {
            name: "התורים שלי",
            short_name: "התורים",
            description: "צפייה בתורים שלי",
            url: "/appointments",
            icons: [{ src: "/icon-192x192.png", sizes: "192x192" }]
          }
        ]
      },
      workbox: {
        // Allow caching our largest JS bundle (~4 MB) instead of Workbox's 2 MB default.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,jpeg,jpg}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: "module"
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}))
