import { resolve } from 'path'
import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'

// Two entries, one codebase:
//  - index.html  — TV UI (Tizen/Android TV). Samsung M5513 runs Chromium ~47
//    with no ES-module support, so plugin-legacy emits a SystemJS bundle;
//    renderModernChunks:false keeps only that bundle (it runs everywhere).
//  - mobile.html — iPhone/Android phone PWA (touch UI, same api/auth modules).
// base:'./' keeps asset URLs relative — the .wgt loads from file:// on the TV
// and the mobile build is served under a sub-path (/m/).
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
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        mobile: resolve(__dirname, 'mobile.html'),
      },
    },
  },
  server: { host: true, port: 5173 },
})
