import { defineConfig } from 'vite';

export default defineConfig({
  // Important for GitHub Pages under /TMLS_playcards_viewer/
  base: '/TMLS_playcards_viewer/',
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',
        solo:  'solo.html',
        room:  'room.html',
      }
    }
  },
  // Dev still works: Vite dev ignores base.
});
