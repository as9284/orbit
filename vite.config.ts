import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

function normalizeSiteUrl(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/$/, "");
}

function resolveSiteUrl(env: Record<string, string>) {
  return normalizeSiteUrl(
    env.VITE_SITE_URL ||
      env.SITE_URL ||
      env.VERCEL_PROJECT_PRODUCTION_URL ||
      env.VERCEL_URL ||
      "https://orbit.vercel.app",
  );
}

function seoAssetsPlugin(siteUrl: string): Plugin {
  return {
    name: "orbit-seo-assets",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: [
          "User-agent: *",
          "Allow: /",
          "Disallow: /notes",
          "Disallow: /archive",
          "Disallow: /luna",
          `Sitemap: ${siteUrl}/sitemap.xml`,
          "",
        ].join("\n"),
      });

      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`,
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const siteUrl = resolveSiteUrl(env);

  return {
    define: {
      __ORBIT_SITE_URL__: JSON.stringify(siteUrl),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;

            if (
              id.includes("react/") ||
              id.includes("react-dom/") ||
              id.includes("scheduler/") ||
              id.includes("react-router")
            ) {
              return "react-core";
            }

            if (id.includes("@supabase/")) {
              return "supabase";
            }

            if (id.includes("react-hot-toast") || id.includes("lucide-react")) {
              return "ui-vendor";
            }

            if (id.includes("date-fns")) {
              return "date-utils";
            }
          },
        },
      },
    },
    plugins: [
      tailwindcss(),
      react(),
      seoAssetsPlugin(siteUrl),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        includeAssets: [
          "orbit.svg",
          "icons/apple-touch-icon.png",
          "icons/icon-192.png",
          "icons/icon-512.png",
        ],
        manifest: {
          id: "/",
          name: "Orbit",
          short_name: "Orbit",
          description:
            "Orbit is a dark-themed productivity workspace for tasks, notes, and AI-assisted focus.",
          theme_color: "#070810",
          background_color: "#070810",
          display: "standalone",
          start_url: "/",
          scope: "/",
          lang: "en",
          categories: ["productivity", "utilities"],
          icons: [
            {
              src: "icons/icon-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "icons/icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "orbit.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any",
            },
          ],
          shortcuts: [
            {
              name: "Dashboard",
              short_name: "Dashboard",
              description: "Open your task dashboard",
              url: "/",
            },
            {
              name: "Notes",
              short_name: "Notes",
              description: "Jump into your notes workspace",
              url: "/notes",
            },
            {
              name: "Luna",
              short_name: "Luna",
              description: "Open the AI assistant",
              url: "/luna",
            },
          ],
        },
        workbox: {
          navigateFallback: "/",
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "google-fonts-stylesheets",
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-webfonts",
                expiration: {
                  maxEntries: 8,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
    ],
  };
});
