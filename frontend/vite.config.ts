import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = process.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/admin': backend,
      '/clk': backend,
      '/postback': backend,
    },
  },
  build: {
    outDir: 'dist',
  },
});