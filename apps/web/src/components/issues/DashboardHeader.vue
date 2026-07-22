<script setup lang="ts">
import type { DashboardProject } from '@/composables/useJiraDashboard'
import type { JiraUser } from '@jira/shared'

const props = defineProps<Props>()
const emit = defineEmits<{
  (event: 'toggleTheme'): void
  (event: 'toggleLanguage'): void
  (event: 'exportIssues'): void
  (event: 'refresh'): void
  (event: 'clearTransitionError'): void
}>()
const projectFilter = defineModel<string>('projectFilter', { required: true })
const unresolvedOnly = defineModel<boolean>('unresolvedOnly', { required: true })
const assigneeFilter = defineModel<string[]>('assigneeFilter', { required: true })
const activeTab = defineModel<'all' | 'todo'>('activeTab', { required: true })

const isAssigneeDropdownOpen = ref(false)
const assigneeDropdownRef = ref<HTMLElement | null>(null)

onClickOutside(assigneeDropdownRef, () => {
  isAssigneeDropdownOpen.value = false
})

const assigneeDisplayText = computed(() => {
  if (assigneeFilter.value.length === 0 || assigneeFilter.value.includes('all')) return 'All Personnel'
  if (assigneeFilter.value.includes('currentUser()') && assigneeFilter.value.length === 1) return 'Me'
  if (assigneeFilter.value.length === 1) {
    const user = props.projectUsers?.find(u => u.name === assigneeFilter.value[0])
    return user ? (user.displayName || user.name) : assigneeFilter.value[0]
  }
  return `${assigneeFilter.value.length} Selected`
})

function toggleAssignee(value: string) {
  if (value === 'all') {
    if (!assigneeFilter.value.includes('all')) {
      assigneeFilter.value = ['all']
    } else {
      assigneeFilter.value = []
    }
    return
  }

  const allIndex = assigneeFilter.value.indexOf('all')
  if (allIndex > -1) {
    assigneeFilter.value.splice(allIndex, 1)
  }

  const idx = assigneeFilter.value.indexOf(value)
  if (idx > -1) {
    assigneeFilter.value.splice(idx, 1)
  } else {
    assigneeFilter.value.push(value)
  }
}

interface Props {
  username: string
  locale: string
  isDark: boolean
  transitionError: string | null
  myProjects: DashboardProject[]
  projectUsers?: JiraUser[]
  isUsersLoading?: boolean
  isInitialLoading: boolean
  isExporting: boolean
  exportProgress: number
  isRefreshing: boolean
  allCount: number
  todoCount: number
}

const { t } = useI18n()
</script>

<template>
  <header class="mb-10 flex flex-col gap-6">
    <section class="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center" aria-label="Dashboard title">
      <div>
        <h1 class="flex items-center gap-3 text-4xl text-gray-900 font-black tracking-tighter dark:text-white">
          <span class="i-logos-jira text-3xl drop-shadow-sm" />
          JIRA BUGS
        </h1>
        <p class="mt-2 flex items-center gap-2 text-gray-500 font-medium dark:text-gray-400">
          Managing tasks for
          <code class="border border-gray-200 rounded-md bg-white px-2 py-0.5 text-teal-600 font-bold shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-teal-400">{{ formatDisplayName(username) }}</code>
        </p>
      </div>

      <div class="w-fit flex items-center gap-1 border border-gray-200 rounded-xl bg-gray-100/80 p-1 backdrop-blur-sm lg:mx-auto dark:border-gray-700 dark:bg-gray-800/80">
        <button
          class="flex items-center gap-2 rounded-lg bg-transparent px-4 py-2 text-sm font-bold transition-all duration-300"
          :class="activeTab === 'all'
            ? 'bg-teal-500/10 dark:bg-teal-400/10 text-teal-600 dark:text-teal-400 ring-1 ring-teal-500/20 dark:ring-teal-400/20 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'"
          type="button"
          @click="activeTab = 'all'"
        >
          <div class="i-tabler-list-details" />
          {{ t('common.all_bugs') || 'All Bugs' }}
          <span
            v-if="allCount > 0"
            class="ml-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-black transition-colors"
            :class="activeTab === 'all'
              ? 'bg-teal-500 text-white dark:bg-teal-400 dark:text-gray-900'
              : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 group-hover:bg-teal-500 group-hover:text-white'"
          >
            {{ allCount }}
          </span>
        </button>
        <button
          class="flex items-center gap-2 rounded-lg bg-transparent px-4 py-2 text-sm font-bold transition-all duration-300"
          :class="activeTab === 'todo'
            ? 'bg-teal-500/10 dark:bg-teal-400/10 text-teal-600 dark:text-teal-400 ring-1 ring-teal-500/20 dark:ring-teal-400/20 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'"
          type="button"
          @click="activeTab = 'todo'"
        >
          <div class="i-tabler-checkbox" />
          {{ t('common.todo_list') || 'Todo List' }}
          <span
            v-if="todoCount > 0"
            class="ml-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-black transition-colors"
            :class="activeTab === 'todo'
              ? 'bg-teal-500 text-white dark:bg-teal-400 dark:text-gray-900'
              : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 group-hover:bg-teal-500 group-hover:text-white'"
          >
            {{ todoCount }}
          </span>
        </button>
      </div>

      <Transition name="fade">
        <aside
          v-if="transitionError"
          id="transition-global-error"
          class="fixed right-6 top-6 z-[200] flex items-center gap-3 border border-red-500/50 rounded-2xl bg-red-500/10 p-4 shadow-2xl shadow-red-900/20 backdrop-blur-md"
          role="status"
          aria-live="assertive"
        >
          <div class="i-tabler-alert-circle text-xl text-red-500" />
          <p class="max-w-sm text-sm text-red-600 font-medium dark:text-red-200">
            {{ transitionError }}
          </p>
          <button
            id="transition-global-error-close"
            class="rounded-lg p-1 text-red-600 transition-colors hover:bg-black/5 dark:text-red-300 dark:hover:bg-white/10"
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
      class="flex flex-wrap items-center gap-4 border border-gray-200/60 rounded-2xl bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-gray-800 dark:bg-gray-900/50 dark:shadow-none"
      aria-label="Dashboard filters"
    >
      <button
        id="dashboard-theme-toggle"
        class="relative h-7 w-12 inline-flex shrink-0 cursor-pointer items-center justify-center border border-gray-200 rounded-full bg-gray-100 shadow-inner transition-colors dark:border-gray-700 dark:bg-gray-800 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:hover:bg-gray-700"
        :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
        type="button"
        @click="emit('toggleTheme')"
      >
        <span class="sr-only">Toggle theme</span>
        <span
          class="pointer-events-none absolute left-0.5 h-6 w-6 flex transform items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition duration-300 ease-in-out dark:bg-gray-900 dark:ring-white/10"
          :class="isDark ? 'translate-x-5' : 'translate-x-0'"
        >
          <div class="i-tabler-sun text-[13px] text-yellow-500 transition duration-300" :class="isDark ? 'opacity-0 scale-50 absolute' : 'opacity-100 scale-100'" />
          <div class="i-tabler-moon text-[13px] text-teal-400 transition duration-300" :class="isDark ? 'opacity-100 scale-100' : 'opacity-0 scale-50 absolute'" />
        </span>
      </button>

      <div class="mx-1 hidden h-6 w-px bg-gray-200 sm:block dark:bg-gray-800" />

      <button
        id="dashboard-language-toggle"
        class="group h-8 flex items-center gap-2 border border-gray-200 rounded-lg bg-gray-50 px-3 py-1.5 text-sm text-gray-500 font-bold transition dark:border-gray-700 hover:border-teal-500/50 dark:bg-gray-800 hover:bg-teal-50 dark:text-gray-400 hover:text-teal-600 dark:hover:bg-teal-500/5 dark:hover:text-teal-400"
        type="button"
        @click="emit('toggleLanguage')"
      >
        <div class="i-tabler-language text-lg transition-transform group-hover:rotate-12" />
        <span class="uppercase">{{ locale === 'zh' ? '中' : 'EN' }}</span>
      </button>

      <div class="mx-1 hidden h-6 w-px bg-gray-200 sm:block dark:bg-gray-800" />

      <div class="flex items-center gap-2">
        <label for="dashboard-project-filter" class="i-tabler-filter text-gray-500 dark:text-gray-500">
          <span class="sr-only">{{ t('common.project_filter') || 'Project filter' }}</span>
        </label>
        <div class="relative min-w-48">
          <select
            id="dashboard-project-filter"
            v-model="projectFilter"
            class="h-8 w-full cursor-pointer appearance-none border border-gray-200 rounded-lg bg-gray-50 py-1 pl-3 pr-8 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-50 focus:ring-2 focus:ring-teal-500"
            :disabled="isInitialLoading"
          >
            <option value="" class="bg-gray-50 text-gray-900 dark:bg-gray-800 dark:text-gray-200">
              {{ isInitialLoading ? t('common.loading_projects') : t('common.all_projects') }}
            </option>
            <option
              v-for="project in myProjects"
              :key="project.key"
              :value="project.key"
              class="bg-gray-50 text-gray-900 dark:bg-gray-800 dark:text-gray-200"
            >
              {{ project.name }}
            </option>
          </select>
          <div class="pointer-events-none absolute right-2 top-1/2 text-gray-400 -translate-y-1/2 dark:text-gray-500">
            <div v-if="isInitialLoading" class="i-tabler-loader-2 animate-spin text-xs" />
            <div v-else class="i-tabler-chevron-down text-xs" />
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <label for="dashboard-assignee-filter" class="i-tabler-user text-gray-500 dark:text-gray-500">
          <span class="sr-only">{{ t('common.assignee_filter') || 'Assignee filter' }}</span>
        </label>
        <div class="relative min-w-40" ref="assigneeDropdownRef">
          <button
            id="dashboard-assignee-filter"
            type="button"
            class="relative flex h-8 w-full cursor-pointer appearance-none items-center justify-between border border-gray-200 rounded-lg bg-gray-50 py-1 pl-3 pr-8 text-sm text-gray-900 outline-none transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-50 focus:ring-2 focus:ring-teal-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            :disabled="isInitialLoading || isUsersLoading"
            @click="isAssigneeDropdownOpen = !isAssigneeDropdownOpen"
          >
            <span class="truncate font-medium">{{ assigneeDisplayText }}</span>
            <div class="pointer-events-none absolute right-2 top-1/2 text-gray-400 -translate-y-1/2 dark:text-gray-500">
              <div v-if="isUsersLoading" class="i-tabler-loader-2 animate-spin text-xs" />
              <div v-else class="i-tabler-chevron-down text-xs" />
            </div>
          </button>
          
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <div
              v-if="isAssigneeDropdownOpen"
              class="absolute right-0 z-20 mt-1.5 max-h-64 w-48 overflow-y-auto border border-gray-200 rounded-xl bg-white py-1.5 shadow-xl dark:border-gray-800 dark:bg-[#1a1a1a]"
            >
              <button
                type="button"
                class="w-full flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors"
                :class="assigneeFilter.includes('all') || assigneeFilter.length === 0 ? 'bg-teal-500 text-white font-bold' : 'bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'"
                @click="toggleAssignee('all')"
              >
                <div :class="assigneeFilter.includes('all') || assigneeFilter.length === 0 ? 'i-tabler-check opacity-100' : 'opacity-0 w-4'" class="shrink-0 text-sm" />
                <span class="truncate">All Personnel</span>
              </button>

              <button
                type="button"
                class="w-full flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors"
                :class="assigneeFilter.includes('currentUser()') ? 'bg-teal-500 text-white font-bold' : 'bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'"
                @click="toggleAssignee('currentUser()')"
              >
                <div :class="assigneeFilter.includes('currentUser()') ? 'i-tabler-check opacity-100' : 'opacity-0 w-4'" class="shrink-0 text-sm" />
                <span class="truncate">Me</span>
              </button>

              <div class="my-1 h-px w-full bg-gray-200 dark:bg-gray-700"></div>

              <button
                v-for="user in projectUsers"
                :key="user.key"
                type="button"
                class="w-full flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors"
                :class="assigneeFilter.includes(user.name) ? 'bg-teal-500 text-white font-bold' : 'bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'"
                @click="toggleAssignee(user.name)"
              >
                <div :class="assigneeFilter.includes(user.name) ? 'i-tabler-check opacity-100' : 'opacity-0 w-4'" class="shrink-0 text-sm" />
                <span class="truncate">{{ user.displayName || user.name }}</span>
              </button>
            </div>
          </Transition>
        </div>
      </div>

      <label
        id="dashboard-unresolved-filter"
        class="group h-8 flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
      >
        <div
          class="relative h-5 w-9 rounded-full shadow-inner transition-colors duration-200"
          :class="unresolvedOnly ? 'bg-teal-500 dark:bg-teal-600' : 'bg-gray-200 dark:bg-gray-700'"
        >
          <input
            id="dashboard-unresolved-checkbox"
            v-model="unresolvedOnly"
            type="checkbox"
            class="hidden"
          >
          <div
            class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-in-out"
            :class="unresolvedOnly ? 'translate-x-4' : 'translate-x-0'"
          />
        </div>
        <span class="text-sm font-bold" :class="unresolvedOnly ? 'text-teal-600 dark:text-teal-400' : 'text-gray-500 dark:text-gray-400'">
          {{ t('common.unresolved_only') }}
        </span>
      </label>

      <div class="mx-1 hidden h-6 w-px bg-gray-200 sm:block dark:bg-gray-800" />

      <button
        id="dashboard-export-issues-button"
        class="h-8 flex items-center gap-2 border border-gray-200 rounded-lg bg-gray-50 px-3 text-sm text-gray-600 font-bold shadow-sm transition hover:border-teal-500/40 hover:bg-teal-50 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-teal-400/40 dark:hover:bg-teal-500/10 dark:hover:text-teal-300"
        :disabled="isExporting || isInitialLoading"
        type="button"
        @click="emit('exportIssues')"
      >
        <div v-if="isExporting" class="i-tabler-loader-2 animate-spin" />
        <div v-else class="i-tabler-file-spreadsheet" />
        {{ isExporting ? `${t('common.exporting_issues')} ${exportProgress}%` : t('common.export_all_issues') }}
      </button>

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
