/// <reference types="vitest" />
import { defineConfig, UserConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on all addresses
    allowedHosts: [
      '.ngrok-free.app', // Allow all ngrok-free.app subdomains
      'localhost',
      '127.0.0.1'
    ]
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
} as UserConfig) 