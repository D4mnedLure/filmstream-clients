import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'

// The target TV (Samsung M5513, Tizen 3.0) runs Chromium ~47, which has no
// ES-module support. plugin-legacy emits a SystemJS/nomodule bundle that runs
// there; renderModernChunks:false keeps ONLY that bundle (single old target).
// base:'./' makes asset URLs relative — the .wgt loads from file:// on the TV.
export default defineConfig({
  base: './',
  plugins: [
    legacy({
      targets: ['chrome >= 47'],
      renderModernChunks: false,
      modernPolyfills: false,
    }),
  ],
  build: {
    target: 'es2015',
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  server: { host: true, port: 5173 },
})
