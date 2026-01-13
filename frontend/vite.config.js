import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  server: {
    port: 3000,
    host: true,
    // Use 'credentialless' for COEP - allows SharedArrayBuffer while permitting cross-origin requests
    // This fixes CORS issues with Linera faucet while maintaining WASM threading support
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    port: 3000,
    host: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'linera-client': ['@linera/client'],
          'chess': ['chess.js'],
          'ethers': ['ethers'],
        },
      },
    },
  },
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  optimizeDeps: {
    // Exclude @linera/client from pre-bundling as it contains WASM
    exclude: ['@linera/client'],
    // Include dependencies that should be pre-bundled
    include: ['react', 'react-dom', 'react-router-dom', 'zustand', 'ethers', 'chess.js'],
  },
  // Ensure WASM files are served with correct MIME type
  assetsInclude: ['**/*.wasm'],
});
