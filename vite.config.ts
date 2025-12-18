
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Fixed: Removed 'process.env': {} which prevents accessing environment variables like process.env.API_KEY
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
