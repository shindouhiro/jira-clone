import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const jiraBaseUrl = env.VITE_JIRA_BASE_URL || '/api-jira'

  return {
    plugins: [
      vue(),
      UnoCSS(),
      AutoImport({
        imports: [
          'vue',
          'vue-router',
          'vue-i18n',
          'pinia',
          '@vueuse/core',
        ],
        dts: 'src/auto-imports.d.ts',
        dirs: [
          'src/composables/**',
          'src/utils/**',
        ],
        vueTemplate: true,
        eslintrc: {
          enabled: true,
        },
      }),
      Components({
        dirs: ['src/components'],
        dts: 'src/components.d.ts',
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '~': fileURLToPath(new URL('./', import.meta.url)),
      },
    },
    server: {
      proxy: {
        [jiraBaseUrl]: {
          target: 'http://jira.cloudtogo.local',
          changeOrigin: true,
          rewrite: path => path.replace(new RegExp(`^${jiraBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), ''),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, _req, _res) => {
              proxyReq.setHeader('X-Atlassian-Token', 'no-check')
              proxyReq.removeHeader('Origin')
              proxyReq.removeHeader('Referer')
              proxyReq.removeHeader('Cookie')
            })
          },
          bypass: (req) => {
            if (req.headers) {
              delete req.headers.origin
              delete req.headers.referer
              delete req.headers.cookie
              // 极其关键：覆盖 User-Agent。如果 Jira 检测到这是浏览器发出的请求且没有 Origin/Referer，会直接判定为 CSRF 攻击并返回 403。
              req.headers['user-agent'] = 'JiraClient/1.0'
            }
          },
        },
      },
    },
  }
})
