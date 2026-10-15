import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the app from /supplier-data-transfer-tracker/.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/supplier-data-transfer-tracker/' : '/',
})
