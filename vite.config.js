import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  // FIX: Automatically switch paths! '/' for local dev, '/Bottle-filling-MPC/' for GitHub
  base: command === 'build' ? '/Bottle-filling-MPC/' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
}))
