<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface Props {
  show: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDangerous?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: '',
  cancelText: '',
  isDangerous: false,
})

const emit = defineEmits<{
  (event: 'confirm'): void
  (event: 'cancel'): void
}>()

const { t } = useI18n()

const finalConfirmText = props.confirmText || t('common.confirm')
const finalCancelText = props.cancelText || t('common.cancel')
</script>

<template>
  <Transition name="modal-fade">
    <div
      v-if="show"
      id="confirmation-modal-overlay"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      @click.self="emit('cancel')"
    >
      <div
        id="confirmation-modal-content"
        class="bg-white dark:bg-[#121212] w-full max-w-sm rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden p-8 animate-in fade-in zoom-in duration-200"
      >
        <div class="flex flex-col items-center text-center">
          <div
            class="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            :class="isDangerous ? 'bg-red-50 text-red-500 dark:bg-red-500/10' : 'bg-teal-50 text-teal-600 dark:bg-teal-500/10'"
          >
            <div :class="isDangerous ? 'i-tabler-alert-triangle text-3xl' : 'i-tabler-help-circle text-3xl'" />
          </div>

          <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-3">
            {{ title }}
          </h3>
          <p class="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
            {{ message }}
          </p>

          <div class="flex flex-col w-full gap-3">
            <button
              id="confirm-button"
              type="button"
              class="w-full py-3.5 rounded-2xl font-bold transition active:scale-95 text-white"
              :class="isDangerous ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20' : 'bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-500/20'"
              @click="emit('confirm')"
            >
              {{ finalConfirmText }}
            </button>
            <button
              id="cancel-button"
              type="button"
              class="w-full py-3.5 rounded-2xl font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              @click="emit('cancel')"
            >
              {{ finalCancelText }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
