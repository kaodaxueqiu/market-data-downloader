import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig(async () => {
  const react = (await import('@vitejs/plugin-react')).default
  const postcssNesting = (await import('postcss-nesting')).default
  const tailwindcss = (await import('@tailwindcss/postcss')).default

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      build: {
        outDir: 'dist-electron/electron',
        rollupOptions: {
          input: {
            index: resolve(__dirname, 'src/electron/index.ts')
          },
          external: []
        },
        watch: {}
      }
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        outDir: 'dist-electron/preload',
        rollupOptions: {
          input: {
            index: resolve(__dirname, 'src/electron/preload.ts')
          }
        }
      }
    },
    renderer: {
      root: '.',
      resolve: {
        alias: {
          '@': resolve(__dirname, './src')
        }
      },
      css: {
        postcss: {
          plugins: [postcssNesting(), tailwindcss()],
        },
      },
      build: {
        outDir: 'dist-electron/renderer',
        rollupOptions: {
          input: {
            index: resolve(__dirname, 'index.html')
          }
        }
      },
      plugins: [react()],
      server: {
        port: 5173
      }
    }
  }
})
