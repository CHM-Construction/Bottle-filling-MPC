import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Tell Vite that we are deploying to a GitHub Pages sub-directory
  base: '/Bottle-filling-MPC/',
  plugins: [
    react(),
    tailwindcss(),
  ],
})
