import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue(), UnoCSS()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '~': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api-jira': {
        target: 'http://jira.cloudtogo.local',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api-jira/, ''),
      },
    },
  },
})
