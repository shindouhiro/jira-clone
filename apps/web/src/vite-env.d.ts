/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_JIRA_USERNAME: string
  readonly VITE_JIRA_PASSWORD: string
  // 可以在此添加更多环境变量...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
