import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig(async () => {
  const react = (await import('@vitejs/plugin-react')).default
  const postcssNesting = (await import('postcss-nesting')).default
  const tailwindcss = (await import('@tailwindcss/postcss')).default

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    css: {
      postcss: {
        plugins: [postcssNesting(), tailwindcss()],
      },
    },
    server: {
      port: 5173,
      open: true
    },
    build: {
      // Keep build output at project root instead of under src/renderer
      outDir: resolve(__dirname, 'dist-web'),
      chunkSizeWarningLimit: 1024,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html')
        },
      }
    }
  }
})
