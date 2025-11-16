import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    electron([
      {
        entry: 'src/main/index.ts',
        onstart(options) {
          options.startup()
        },
        vite: {
          build: {
            outDir: 'dist/electron/main',
            rollupOptions: {
              external: Object.keys(require('./package.json').dependencies || {})
            }
          }
        }
      },
      {
        entry: 'src/preload/index.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist/electron/preload',
            rollupOptions: {
              external: Object.keys(require('./package.json').dependencies || {})
            }
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer')
    }
  },
  server: {
    host: '127.0.0.1',  // 只监听IPv4，避免IPv6权限问题
    port: 5173
  },
  build: {
    outDir: 'dist/renderer'
  }
})
