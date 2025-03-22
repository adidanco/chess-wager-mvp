import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // If you want to listen on all interfaces, do host: true
    host: true,

    // ALLOW your ngrok domain (replace with the domain you see in your terminal)
    allowedHosts: [
      'd1ef-2401-4900-1f27-27bf-810d-977e-607f-4a67.ngrok-free.app'
    ],

    // If you want to allow all subdomains of ngrok-free.app, you can do:
    // allowedHosts: ['.ngrok-free.app']  // <--- wildcard
  }
})
