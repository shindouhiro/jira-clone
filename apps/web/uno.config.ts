import { defineConfig, presetAttributify, presetIcons, presetTypography, presetUno, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig({
  shortcuts: [
    ['btn', 'px-4 py-1.5 rounded-xl bg-teal-600 text-white font-bold transition-all hover:bg-teal-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none'],
    ['card', 'bg-gray-900/40 border border-gray-800/50 p-6 rounded-3xl transition-all hover:bg-gray-900/60 hover:border-gray-700'],
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
