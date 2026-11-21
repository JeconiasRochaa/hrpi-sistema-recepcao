import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';

// Modo "demo": usa um backend em memória (dev-tools/demo) no lugar do Firebase,
// apenas para desenvolvimento/testes visuais. NUNCA é usado no build de produção.
export default defineConfig(({ mode }) => {
  const demoDir = path.resolve(__dirname, 'dev-tools/demo');
  const useDemo = mode === 'demo' && fs.existsSync(demoDir);
  const alias: Record<string, string> = { '@': path.resolve(__dirname, 'src') };
  if (useDemo) {
    alias['firebase/app'] = path.join(demoDir, 'app.ts');
    alias['firebase/auth'] = path.join(demoDir, 'auth.ts');
    alias['firebase/database'] = path.join(demoDir, 'database.ts');
  }
  return {
    plugins: [react()],
    resolve: { alias },
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/database'],
            charts: ['recharts'],
          },
        },
      },
    },
    server: { port: 5173 },
  };
});
