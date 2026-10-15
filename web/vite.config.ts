import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* VITE_API_URL is baked in at build time (the API's public address). In development /api goes to a local API. */
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': process.env.API_PROXY ?? 'http://localhost:3100' } },
  build: { chunkSizeWarningLimit: 900 },
});
