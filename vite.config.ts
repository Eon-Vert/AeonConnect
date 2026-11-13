import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        loadPaths: [path.resolve(__dirname, 'node_modules')],
        quietDeps: true,
        silenceDeprecations: ['mixed-decls', 'import', 'global-builtin'],
      },
    },
  },
  build: { chunkSizeWarningLimit: 2500 },
});
