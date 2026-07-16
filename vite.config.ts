import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Do not publish readable student-client source maps with classroom builds.
    sourcemap: false,
  },
})
