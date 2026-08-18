import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/accounts': 'http://127.0.0.1:8000',
      '/edi835': 'http://127.0.0.1:8000',
    }
  },
  build: {
    outDir: '../static/react',
    emptyOutDir: true,
  }
})

