import { defineConfig } from 'vite'

export default defineConfig({
  // Evitar que Vite reemplace process.env
  define: {
    'process.env': {}
  },
  build: {
    outDir: 'dist',
    target: ['chrome105', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**']
    }
  }
})
