import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    // Development only: allow the hosted preview hosts used for QA.
    allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'],
    proxy: { '/api': 'http://localhost:3001' }
  },
  build: {
    rollupOptions: {
      // The POS back office and the public customer QR menu are separate pages.
      input: { main: 'index.html', menu: 'menu.html' }
    }
  }
});
