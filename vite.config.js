import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@services': path.resolve(__dirname, 'src/services'),
      '@lib'     : path.resolve(__dirname, 'src/lib'),
      '@ui'      : path.resolve(__dirname, 'src/ui'),
      '@config'  : path.resolve(__dirname, 'src/config'),
    }
  }
});
