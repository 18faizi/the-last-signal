import { defineConfig } from 'vite';

export default defineConfig({
  // @babylonjs/havok ships a WASM artifact that esbuild's dependency
  // pre-bundling cannot process; excluding it lets the browser load the
  // package's own loader, which resolves the .wasm file relative to itself.
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    fs: {
      strict: true,
    },
  },
});
