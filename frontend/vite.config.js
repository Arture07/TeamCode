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
    }
  },
  define: {
    global: 'globalThis',
    process: {
      env: {}
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