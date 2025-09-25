import { defineConfig } from 'vite';

// Small, focused aliases for readability and safer refactors.
export default defineConfig({
  resolve: {
    alias: {
      '@services': '/src/services',
      '@ui': '/src/ui',
      '@lib': '/src/lib',
    },
  },
});
