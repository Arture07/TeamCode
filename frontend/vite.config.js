// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      path: 'path-browserify',
      stream: 'stream-browserify',
      util: 'util'
    },
    dedupe: ['react', 'react-dom']
  },
  define: {
    global: 'globalThis',
    process: {
      env: {}
    }
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    reportCompressedSize: false,
    sourcemap: false,
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      maxParallelFileOps: 2
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  }
})