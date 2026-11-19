import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { loadEnv } from "vite";
import { normalizeDomain, offlineLicensePlugin, validateBuyerConnection } from "./scripts/offline-license.mjs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const locked = mode === 'locked';
  const domain = locked ? normalizeDomain(process.env.OFFLINE_RELEASE_DOMAIN) : undefined;
  const buyer = locked ? validateBuyerConnection(
    process.env.BUYER_BACKEND_URL,
    process.env.BUYER_PUBLISHABLE_KEY,
    loadEnv('production', process.cwd(), 'VITE_SUPABASE').VITE_SUPABASE_URL,
  ) : undefined;
  return {
  ...(buyer ? {
    envDir: path.resolve(__dirname, 'scripts'),
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(buyer.url),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(buyer.key),
    },
    build: { outDir: `dist/locked/${domain}`, sourcemap: false },
  } : {}),
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    ...(domain ? [offlineLicensePlugin(domain)] : []),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  };
});
