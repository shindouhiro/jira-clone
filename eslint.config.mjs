import antfu from '@antfu/eslint-config'

export default antfu(
  {
    formatters: true,
    unocss: true,
    vue: true,
    typescript: true,
    yaml: true,
    pnpm: true,
  },
  {
    rules: {
      'no-console': 'off',
    },
  },
)
