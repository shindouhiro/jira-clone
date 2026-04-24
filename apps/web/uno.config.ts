import { defineConfig, presetAttributify, presetIcons, presetTypography, presetUno, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig({
  shortcuts: [
    ['btn', 'px-4 py-1.5 rounded-xl bg-white dark:bg-teal-500/10 border border-teal-600/20 dark:border-teal-500/30 text-teal-600 dark:text-teal-400 font-bold transition-all hover:bg-teal-50 dark:hover:bg-teal-500/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none'],
    ['card', 'bg-white border border-gray-200/80 p-6 rounded-3xl transition-all hover:bg-gray-50/50 hover:border-gray-300 dark:bg-gray-900/40 dark:border-gray-800/50 dark:hover:bg-gray-900/60 dark:hover:border-gray-700'],
  ],
  content: {
    pipeline: {
      include: [
        /\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/,
        'src/**/*.ts',
      ],
    },
  },
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
    presetTypography(),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
})
