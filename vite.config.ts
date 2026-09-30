import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The PDF engine runs in a module worker so it never blocks the page.
  worker: { format: 'es' },
  // Pre-bundle our heavy dependencies up front. Left to itself the dev server
  // discovers them late (they sit behind a worker and a dynamic import),
  // re-optimizes, and reloads the page in the middle of a run.
  optimizeDeps: {
    include: ['pdf-lib', '@pdf-lib/fontkit', 'fflate', 'pdfjs-dist', 'mammoth'],
  },
})
