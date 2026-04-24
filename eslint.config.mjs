import antfu from '@antfu/eslint-config'

export default antfu(
  {
    formatters: true,
    unocss: false,
    vue: true,
    typescript: true,
  },
  {
    rules: {
      'no-console': 'off',
    },
  },
)
