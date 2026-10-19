import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The client always calls a relative /api path. In development Vite forwards
// those calls to the Express server, so no CORS setup is needed.
// The browser tests run their own copy on other ports (see playwright.config.ts).
const clientPort = Number(process.env.CLIENT_PORT) || 5173
const apiPort = Number(process.env.PORT) || 3001

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: clientPort,
    strictPort: true,
    proxy: {
      '/api': { target: `http://localhost:${apiPort}`, changeOrigin: true },
    },
  },
})
