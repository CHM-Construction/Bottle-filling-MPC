import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  // FIX: Use '/' for local dev, but '/Bottle-filling-MPC/' for GitHub Pages!
  base: command === 'build' ? '/Bottle-filling-MPC/' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
}))
