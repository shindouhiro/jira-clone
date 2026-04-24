<script setup lang="ts">
import { JiraClient } from '@jira/shared'
import { computed, ref } from 'vue'

const jira = new JiraClient('wuweidong', 'Wu83609045@')

// 1. 获取分配给我的所有 Bug（用于提取“我的项目”列表）
const { data: allMyIssuesData, isFetching: isInitialLoading } = jira.getBugs(() => '', () => false, 200)

// 从分配给我的任务中提取唯一的项目列表
const myProjects = computed(() => {
  const issues = allMyIssuesData.value?.issues || []
  const projectMap = new Map()
  issues.forEach((issue) => {
    const p = issue.fields.project
    if (!projectMap.has(p.key)) {
      projectMap.set(p.key, {
        key: p.key,
        name: p.name,
      })
    }
  })
  return Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name))
})

// 过滤器状态
const projectFilter = ref('')
const unresolvedOnly = ref(true)

// 2. 实际显示的 Bug 列表 - 响应过滤器的变化
const {
  data,
  error: fetchError,
  isFetching,
  execute: fetchBugs,
} = jira.getBugs(
  () => projectFilter.value,
  () => unresolvedOnly.value,
)

const issues = computed(() => data.value?.issues || [])

// 统一错误处理
const errorMessage = computed(() => {
  if (!fetchError.value)
    return null
  return '获取数据失败，请检查网络或登录状态'
})

// 状态修改逻辑
const updatingKeys = ref<Set<string>>(new Set())

async function handleTransition(issueKey: string, transitionId: string) {
  updatingKeys.value.add(issueKey)
  try {
    const { error, execute } = jira.doTransition(issueKey, transitionId)
    await execute()
    if (!error.value) {
      await fetchBugs()
    }
  }
  finally {
    updatingKeys.value.delete(issueKey)
  }
}

// 简单的状态颜色映射
const statusColors: Record<string, string> = {
  'To Do': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  'In Progress': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  'Done': 'bg-green-500/20 text-green-400 border-green-500/50',
  'Resolved': 'bg-green-500/20 text-green-400 border-green-500/50',
  'Open': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50',
}

function getStatusClass(status: string) {
  return statusColors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/50'
}
</script>

<template>
  <div class="min-h-screen bg-[#0a0a0a] text-gray-200 p-6 md:p-12 font-sans">
    <div class="max-w-5xl mx-auto">
      <!-- Header -->
      <header class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
        <div>
          <h1 class="text-4xl font-black tracking-tighter text-white flex items-center gap-3">
            <span class="i-logos-jira text-3xl" />
            JIRA BUGS
          </h1>
          <p class="text-gray-500 mt-1">
            Managing tasks for <code class="bg-gray-800 px-1 rounded text-teal-400">wuweidong</code>
          </p>
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap items-center gap-4 bg-gray-900/50 p-4 rounded-2xl border border-gray-800">
          <div class="flex items-center gap-2">
            <div class="i-tabler-filter text-gray-500" />
            <div class="relative min-w-48">
              <select
                v-model="projectFilter"
                class="appearance-none bg-gray-800 border-none rounded-lg pl-3 pr-8 py-1.5 text-sm text-white focus:ring-2 focus:ring-teal-500 outline-none w-full cursor-pointer disabled:opacity-50"
                :disabled="isInitialLoading"
              >
                <option value="" class="bg-gray-800 text-gray-200">
                  {{ isInitialLoading ? 'Loading My Projects...' : 'All My Projects' }}
                </option>
                <option v-for="p in myProjects" :key="p.key" :value="p.key" class="bg-gray-800 text-gray-200">
                  {{ p.name }}
                </option>
              </select>
              <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                <div v-if="isInitialLoading" class="i-tabler-loader-2 animate-spin text-xs" />
                <div v-else class="i-tabler-chevron-down text-xs" />
              </div>
            </div>
          </div>

          <label class="flex items-center gap-2 cursor-pointer select-none group">
            <div
              class="w-10 h-5 rounded-full relative transition-colors duration-200"
              :class="unresolvedOnly ? 'bg-teal-600' : 'bg-gray-700'"
            >
              <input v-model="unresolvedOnly" type="checkbox" class="hidden">
              <div
                class="absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform duration-200"
                :class="unresolvedOnly ? 'translate-x-5' : 'translate-x-0'"
              />
            </div>
            <span class="text-sm font-medium" :class="unresolvedOnly ? 'text-teal-400' : 'text-gray-500'">Unresolved Only</span>
          </label>

          <div class="w-px h-6 bg-gray-800 mx-2 hidden sm:block" />

          <button
            class="btn flex items-center gap-2 shadow-lg shadow-teal-900/20"
            :disabled="isFetching"
            @click="() => fetchBugs()"
          >
            <div v-if="isFetching" class="i-tabler-loader-2 animate-spin" />
            <div v-else class="i-tabler-refresh" />
            {{ isFetching ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </header>

      <!-- Error Message -->
      <Transition name="fade">
        <div v-if="errorMessage" class="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
          <div class="i-tabler-alert-circle text-xl" />
          {{ errorMessage }}
        </div>
      </Transition>

      <!-- Loading State -->
      <div v-if="isFetching && issues.length === 0" class="flex flex-col items-center justify-center py-20 gap-4">
        <div class="i-tabler-loader-2 text-5xl text-teal-500 animate-spin" />
        <p class="text-gray-500 animate-pulse">
          Fetching your bugs...
        </p>
      </div>

      <!-- Bug List -->
      <div v-else class="grid gap-4">
        <TransitionGroup name="list">
          <div v-for="issue in issues" :key="issue.key" class="card group relative overflow-hidden">
            <!-- Loading overlay for specific card -->
            <div v-if="updatingKeys.has(issue.key)" class="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center">
              <div class="i-tabler-loader-2 text-3xl text-teal-500 animate-spin" />
            </div>

            <div class="flex flex-col md:flex-row justify-between gap-6">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-3">
                  <span class="text-sm font-mono font-bold text-teal-500 bg-teal-500/10 px-2 py-0.5 rounded">
                    {{ issue.key }}
                  </span>
                  <span class="text-xs px-2 py-0.5 rounded-full border" :class="getStatusClass(issue.fields.status.name)">
                    {{ issue.fields.status.name }}
                  </span>
                </div>
                <h3 class="text-xl font-semibold text-white mb-4 group-hover:text-teal-400 transition-colors">
                  {{ issue.fields.summary }}
                </h3>
                <div class="flex flex-wrap gap-4 text-sm text-gray-500">
                  <span class="flex items-center gap-1.5">
                    <div class="i-tabler-user text-gray-600" />
                    {{ issue.fields.assignee?.displayName || 'Unassigned' }}
                  </span>
                  <span class="flex items-center gap-1.5">
                    <div class="i-tabler-alert-triangle text-gray-600" />
                    {{ issue.fields.priority.name }}
                  </span>
                  <span class="flex items-center gap-1.5">
                    <div class="i-tabler-calendar text-gray-600" />
                    {{ new Date(issue.fields.created).toLocaleDateString() }}
                  </span>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="flex flex-col justify-center gap-2 min-w-140px">
                <p class="text-[10px] uppercase tracking-widest text-gray-600 font-bold mb-1">
                  Actions
                </p>
                <div class="flex flex-wrap md:flex-col gap-2">
                  <button
                    v-if="issue.fields.status.name !== 'In Progress'"
                    class="px-3 py-1.5 text-xs rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 hover:bg-yellow-500 hover:text-black transition-all flex items-center gap-2"
                    @click="handleTransition(issue.key, '21')"
                  >
                    <div class="i-tabler-player-play" /> Start Progress
                  </button>
                  <button
                    v-if="issue.fields.status.name !== 'Done' && issue.fields.status.name !== 'Resolved'"
                    class="px-3 py-1.5 text-xs rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500 hover:text-black transition-all flex items-center gap-2"
                    @click="handleTransition(issue.key, '31')"
                  >
                    <div class="i-tabler-check" /> Resolve
                  </button>
                  <button
                    v-if="issue.fields.status.name === 'Done' || issue.fields.status.name === 'Resolved' || issue.fields.status.name === 'In Progress'"
                    class="px-3 py-1.5 text-xs rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all flex items-center gap-2"
                    @click="handleTransition(issue.key, '11')"
                  >
                    <div class="i-tabler-arrow-back-up" /> Reopen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </TransitionGroup>
      </div>

      <!-- Empty State -->
      <div v-if="!isFetching && issues.length === 0" class="text-center py-20 border-2 border-dashed border-gray-800 rounded-3xl">
        <div class="i-tabler-mood-empty text-5xl text-gray-700 mx-auto mb-4" />
        <h3 class="text-xl font-bold text-gray-400">
          No bugs found
        </h3>
        <p class="text-gray-600">
          You're all caught up! Go grab a coffee.
        </p>
      </div>
    </div>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* Hide default styles from old implementation */
body {
  margin: 0;
  background: #0a0a0a;
}

.btn {
  @apply px-4 py-1.5 rounded-xl bg-teal-600 text-white font-bold transition-all hover:bg-teal-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none;
}

.card {
  @apply bg-gray-900/40 border border-gray-800/50 p-6 rounded-3xl transition-all hover:bg-gray-900/60 hover:border-gray-700;
}
</style>
