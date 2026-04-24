import { defineConfig, presetAttributify, presetIcons, presetTypography, presetUno, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig({
  shortcuts: [
    ['btn', 'px-4 py-1.5 rounded-xl bg-teal-600 text-white font-bold transition-all hover:bg-teal-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none'],
    ['card', 'bg-white border border-gray-200/80 p-6 rounded-3xl transition-all hover:bg-gray-50/50 hover:border-gray-300 dark:bg-gray-900/40 dark:border-gray-800/50 dark:hover:bg-gray-900/60 dark:hover:border-gray-700'],
  ],
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: true,
      cdn: 'https://esm.sh/',
    }),
    presetTypography(),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
})
