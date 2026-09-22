import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    __VITE_SUPABASE_URL__: JSON.stringify(process.env.VITE_SUPABASE_URL),
    __VITE_SUPABASE_ANON_KEY__: JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
    __VITE_GOOGLE_CLIENT_ID__: JSON.stringify(process.env.VITE_GOOGLE_CLIENT_ID),
  },
  server: {
    port: 5173,
    open: true
  }
})