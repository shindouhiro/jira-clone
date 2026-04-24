<script setup lang="ts">
import type { DashboardProject } from '@/composables/useJiraDashboard'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  username: string
  locale: string
  isDark: boolean
  transitionError: string | null
  projectFilter: string
  unresolvedOnly: boolean
  myProjects: DashboardProject[]
  isInitialLoading: boolean
  isRefreshing: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (event: 'toggleTheme'): void
  (event: 'toggleLanguage'): void
  (event: 'update:projectFilter', value: string): void
  (event: 'update:unresolvedOnly', value: boolean): void
  (event: 'refresh'): void
  (event: 'clearTransitionError'): void
}>()

const { t } = useI18n()

const projectFilterModel = computed({
  get: () => props.projectFilter,
  set: (value: string) => emit('update:projectFilter', value),
})

const unresolvedOnlyModel = computed({
  get: () => props.unresolvedOnly,
  set: (value: boolean) => emit('update:unresolvedOnly', value),
})
</script>

<template>
  <header class="flex flex-col gap-6 mb-10">
    <section class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6" aria-label="Dashboard title">
      <div>
        <h1 class="text-4xl font-black tracking-tighter text-gray-900 dark:text-white flex items-center gap-3">
          <span class="i-logos-jira text-3xl drop-shadow-sm" />
          JIRA BUGS
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 font-medium flex items-center gap-2">
          Managing tasks for
          <code class="bg-white dark:bg-gray-800 px-2 py-0.5 rounded-md text-teal-600 dark:text-teal-400 font-bold border border-gray-200 dark:border-gray-700 shadow-sm">{{ username }}</code>
        </p>
      </div>

      <Transition name="fade">
        <aside
          v-if="transitionError"
          id="transition-global-error"
          class="fixed top-6 right-6 z-[200] bg-red-500/10 border border-red-500/50 backdrop-blur-md p-4 rounded-2xl flex items-center gap-3 shadow-2xl shadow-red-900/20"
          role="status"
          aria-live="assertive"
        >
          <div class="i-tabler-alert-circle text-red-500 text-xl" />
          <p class="text-red-600 dark:text-red-200 text-sm font-medium max-w-sm">
            {{ transitionError }}
          </p>
          <button
            id="transition-global-error-close"
            class="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors text-red-600 dark:text-red-300"
            type="button"
            @click="emit('clearTransitionError')"
          >
            <span class="sr-only">close transition error</span>
            <div class="i-tabler-x" />
          </button>
        </aside>
      </Transition>
    </section>

    <section
      class="flex flex-wrap items-center gap-4 bg-white dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200/60 dark:border-gray-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none"
      aria-label="Dashboard filters"
    >
      <button
        id="dashboard-theme-toggle"
        class="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-inner transition-colors focus:outline-none hover:bg-gray-200 dark:hover:bg-gray-700"
        :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
        type="button"
        @click="emit('toggleTheme')"
      >
        <span class="sr-only">Toggle theme</span>
        <span
          class="pointer-events-none absolute left-0.5 flex h-6 w-6 transform items-center justify-center rounded-full bg-white dark:bg-gray-900 shadow-sm ring-1 ring-black/5 dark:ring-white/10 transition duration-300 ease-in-out"
          :class="isDark ? 'translate-x-5' : 'translate-x-0'"
        >
          <div class="i-tabler-sun text-yellow-500 text-[13px] transition-all duration-300" :class="isDark ? 'opacity-0 scale-50 absolute' : 'opacity-100 scale-100'" />
          <div class="i-tabler-moon text-teal-400 text-[13px] transition-all duration-300" :class="isDark ? 'opacity-100 scale-100' : 'opacity-0 scale-50 absolute'" />
        </span>
      </button>

      <div class="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1 hidden sm:block" />

      <button
        id="dashboard-language-toggle"
        class="group flex items-center gap-2 px-3 py-1.5 h-8 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-teal-500/50 hover:bg-teal-50 dark:hover:bg-teal-500/5 transition-all text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400"
        type="button"
        @click="emit('toggleLanguage')"
      >
        <div class="i-tabler-language text-lg group-hover:rotate-12 transition-transform" />
        <span class="uppercase">{{ locale === 'zh' ? '中' : 'EN' }}</span>
      </button>

      <div class="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1 hidden sm:block" />

      <div class="flex items-center gap-2">
        <label for="dashboard-project-filter" class="i-tabler-filter text-gray-500 dark:text-gray-500" />
        <div class="relative min-w-48">
          <select
            id="dashboard-project-filter"
            v-model="projectFilterModel"
            class="appearance-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-8 py-1 h-8 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none w-full cursor-pointer disabled:opacity-50"
            :disabled="isInitialLoading"
          >
            <option value="" class="bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-200">
              {{ isInitialLoading ? t('common.loading_projects') : t('common.all_projects') }}
            </option>
            <option
              v-for="project in myProjects"
              :key="project.key"
              :value="project.key"
              class="bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-200"
            >
              {{ project.name }}
            </option>
          </select>
          <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
            <div v-if="isInitialLoading" class="i-tabler-loader-2 animate-spin text-xs" />
            <div v-else class="i-tabler-chevron-down text-xs" />
          </div>
        </div>
      </div>

      <label
        id="dashboard-unresolved-filter"
        class="flex items-center gap-2 cursor-pointer select-none group h-8 px-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div
          class="w-9 h-5 rounded-full relative transition-colors duration-200 shadow-inner"
          :class="unresolvedOnlyModel ? 'bg-teal-500 dark:bg-teal-600' : 'bg-gray-200 dark:bg-gray-700'"
        >
          <input
            id="dashboard-unresolved-checkbox"
            v-model="unresolvedOnlyModel"
            type="checkbox"
            class="hidden"
          >
          <div
            class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-in-out"
            :class="unresolvedOnlyModel ? 'translate-x-4' : 'translate-x-0'"
          />
        </div>
        <span class="text-sm font-bold" :class="unresolvedOnlyModel ? 'text-teal-600 dark:text-teal-400' : 'text-gray-500 dark:text-gray-400'">
          {{ t('common.unresolved_only') }}
        </span>
      </label>

      <div class="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1 hidden sm:block" />

      <button
        id="dashboard-refresh-button"
        class="btn flex items-center gap-2 shadow-lg shadow-teal-900/20"
        :disabled="isRefreshing"
        type="button"
        @click="emit('refresh')"
      >
        <div v-if="isRefreshing" class="i-tabler-loader-2 animate-spin" />
        <div v-else class="i-tabler-refresh" />
        {{ isRefreshing ? t('common.refreshing') : t('common.refresh') }}
      </button>
    </section>
  </header>
</template>
