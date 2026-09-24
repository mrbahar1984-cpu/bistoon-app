import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// پلاگین هوشمند برای حل خودکار فایل ورودی چه در ریشه پروژه باشد و چه در پوشه src
function htmlEntryPlugin() {
  return {
    name: 'html-entry-fallback',
    resolveId(id: string) {
      const cleanId = id.replace(/^\/+/, '');
      if (
        cleanId === 'index.tsx' ||
        cleanId === 'src/index.tsx' ||
        cleanId === 'src/main.tsx' ||
        cleanId === 'main.tsx' ||
        id === '/index.tsx' ||
        id === '/src/index.tsx' ||
        id === '/src/main.tsx'
      ) {
        const candidates = [
          path.resolve(process.cwd(), 'index.tsx'),
          path.resolve(process.cwd(), 'src/index.tsx'),
          path.resolve(process.cwd(), 'src/main.tsx'),
          path.resolve(process.cwd(), 'main.tsx'),
          path.resolve(process.cwd(), 'index.ts'),
          path.resolve(process.cwd(), 'src/index.ts')
        ];
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            return candidate;
          }
        }
      }
      return null;
    }
  };
}

export default defineConfig({
  plugins: [
    htmlEntryPlugin(),
    react(),
  ],
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
