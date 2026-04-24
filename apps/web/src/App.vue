<script setup lang="ts">
import { JiraClient } from '@jira/shared'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

function toggleLanguage() {
  locale.value = locale.value === 'zh' ? 'en' : 'zh'
}

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

// 详情弹窗状态
const selectedIssueKey = ref<string | null>(null)
const { data: detailData, isFetching: isDetailFetching, execute: fetchDetail } = jira.getIssueDetail(() => selectedIssueKey.value)

const selectedIssue = computed(() => detailData.value)

// 3. 获取当前 Issue 可执行的转换
const { data: transitionsData, isFetching: isTransitionsFetching, execute: fetchTransitions } = jira.getTransitions(() => selectedIssueKey.value)
const transitions = computed(() => transitionsData.value?.transitions || [])

function openDetail(key: string) {
  selectedIssueKey.value = key
  fetchDetail()
  fetchTransitions()
}

function closeDetail() {
  selectedIssueKey.value = null
}

// 附件相关逻辑
const images = computed(() => {
  return selectedIssue.value?.fields.attachment?.filter((a) => {
    const isMimeImage = a.mimeType.startsWith('image/')
    const isExtImage = /\.(?:png|jpe?g|gif|webp|bmp|svg)$/i.test(a.filename)
    return isMimeImage || isExtImage
  }) || []
})

const otherFiles = computed(() => {
  return selectedIssue.value?.fields.attachment?.filter((a) => {
    const isMimeImage = a.mimeType.startsWith('image/')
    const isExtImage = /\.(?:png|jpe?g|gif|webp|bmp|svg)$/i.test(a.filename)
    return !isMimeImage && !isExtImage
  }) || []
})

// 图片预览状态
const previewImageUrl = ref<string | null>(null)
const isLoadingPreview = ref(false)

async function openPreview(url: string) {
  isLoadingPreview.value = true
  previewImageUrl.value = 'loading'
  try {
    const proxiedUrl = jira.resolveUrl(url)
    const res = await fetch(proxiedUrl, { headers: jira.getAuthHeaders() })
    const blob = await res.blob()
    previewImageUrl.value = URL.createObjectURL(blob)
  }
  finally {
    isLoadingPreview.value = false
  }
}

function closePreview() {
  if (previewImageUrl.value && previewImageUrl.value !== 'loading') {
    URL.revokeObjectURL(previewImageUrl.value)
  }
  previewImageUrl.value = null
}

const imageThumbnails = ref<Record<string, string>>({})
watch(selectedIssue, async (newIssue) => {
  if (!newIssue) {
    Object.values(imageThumbnails.value).forEach(URL.revokeObjectURL)
    imageThumbnails.value = {}
    return
  }

  const imgs = newIssue.fields.attachment?.filter((a) => {
    const isMimeImage = a.mimeType.startsWith('image/')
    const isExtImage = /\.(?:png|jpe?g|gif|webp|bmp|svg)$/i.test(a.filename)
    return isMimeImage || isExtImage
  }) || []

  for (const img of imgs) {
    const originalUrl = img.thumbnail || img.content
    const proxiedUrl = jira.resolveUrl(originalUrl)

    if (!imageThumbnails.value[originalUrl]) {
      try {
        const res = await fetch(proxiedUrl, { headers: jira.getAuthHeaders() })
        const blob = await res.blob()
        imageThumbnails.value[originalUrl] = URL.createObjectURL(blob)
      }
      catch (e) {
        console.error('Failed to load thumbnail:', e)
      }
    }
  }
})

// 统一错误处理
const errorMessage = computed(() => {
  if (!fetchError.value)
    return null
  return t('common.error_fetch')
})

// 状态修改逻辑
const updatingKeys = ref<Set<string>>(new Set())

const transitionError = ref<string | null>(null)

async function handleTransition(issueKey: string, transitionId: string) {
  updatingKeys.value.add(issueKey)
  transitionError.value = null
  try {
    const { error, execute, data } = jira.doTransition(issueKey, transitionId)
    await execute()
    if (error.value) {
      // 尝试从响应数据中获取更详细的错误信息
      const detail = data.value?.errorMessages?.[0] || data.value?.errors?.[Object.keys(data.value?.errors || {})[0]] || error.value
      transitionError.value = `${t('common.error_fetch')}: ${detail}`

      // 如果是 500 错误，打印更多上下文
      console.error('Transition failed with Status:', error.value)
      console.error('Response Data:', data.value)
    }
    else {
      await fetchBugs()
      // 如果当前弹窗打开的是这个 Issue，更新详情
      if (selectedIssueKey.value === issueKey) {
        await fetchDetail()
      }
    }
  }
  catch (e) {
    transitionError.value = `An unexpected error occurred: ${e}`
  }
  finally {
    updatingKeys.value.delete(issueKey)
  }
}

// 简单的状态颜色映射
const statusColors: Record<string, string> = {
  // English
  'To Do': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  'In Progress': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  'Done': 'bg-green-500/20 text-green-400 border-green-500/50',
  'Resolved': 'bg-green-500/20 text-green-400 border-green-500/50',
  'Open': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50',
  // Chinese
  '待办': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  '处理中': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  '进行中': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  '已完成': 'bg-green-500/20 text-green-400 border-green-500/50',
  '已解决': 'bg-green-500/20 text-green-400 border-green-500/50',
  '开放': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50',
}

function getStatusClass(status: string) {
  return statusColors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/50'
}

// 描述文本清洗：移除 Jira 的 !image.png|width=...! 标记，因为我们已经在下方展示了图片
const cleanedDescription = computed(() => {
  const desc = selectedIssue.value?.fields.description
  if (!desc)
    return ''
  // 匹配 !filename.ext|attr! 或 !filename.ext!
  return desc.replace(/!.*?!/g, '').trim()
})
</script>

<template>
  <div class="min-h-screen bg-[#0a0a0a] text-gray-200 p-6 md:p-12 font-sans selection:bg-teal-500/30">
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

        <!-- Global Transition Error -->
        <Transition name="fade">
          <div v-if="transitionError" class="fixed top-6 right-6 z-[200] bg-red-500/10 border border-red-500/50 backdrop-blur-md p-4 rounded-2xl flex items-center gap-3 shadow-2xl shadow-red-900/20">
            <div class="i-tabler-alert-circle text-red-500 text-xl" />
            <p class="text-red-200 text-sm font-medium max-w-sm">
              {{ transitionError }}
            </p>
            <button class="p-1 hover:bg-white/10 rounded-lg transition-colors text-red-300" @click="transitionError = null">
              <div class="i-tabler-x" />
            </button>
          </div>
        </Transition>

        <!-- Filters & Language -->
        <div class="flex flex-wrap items-center gap-4 bg-gray-900/50 p-4 rounded-2xl border border-gray-800">
          <!-- Language Toggle -->
          <button
            class="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700 hover:border-teal-500/50 hover:bg-teal-500/5 transition-all text-sm font-bold text-gray-400 hover:text-teal-400"
            @click="toggleLanguage"
          >
            <div class="i-tabler-language text-lg group-hover:rotate-12 transition-transform" />
            <span class="uppercase">{{ locale === 'zh' ? '中' : 'EN' }}</span>
          </button>

          <div class="w-px h-6 bg-gray-800 mx-1 hidden sm:block" />

          <div class="flex items-center gap-2">
            <div class="i-tabler-filter text-gray-500" />
            <div class="relative min-w-48">
              <select
                v-model="projectFilter"
                class="appearance-none bg-gray-800 border-none rounded-lg pl-3 pr-8 py-1.5 text-sm text-white focus:ring-2 focus:ring-teal-500 outline-none w-full cursor-pointer disabled:opacity-50"
                :disabled="isInitialLoading"
              >
                <option value="" class="bg-gray-800 text-gray-200">
                  {{ isInitialLoading ? t('common.loading_projects') : t('common.all_projects') }}
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
            <span class="text-sm font-medium" :class="unresolvedOnly ? 'text-teal-400' : 'text-gray-500'">
              {{ t('common.unresolved_only') }}
            </span>
          </label>

          <div class="w-px h-6 bg-gray-800 mx-2 hidden sm:block" />

          <button
            class="btn flex items-center gap-2 shadow-lg shadow-teal-900/20"
            :disabled="isFetching"
            @click="() => fetchBugs()"
          >
            <div v-if="isFetching" class="i-tabler-loader-2 animate-spin" />
            <div v-else class="i-tabler-refresh" />
            {{ isFetching ? t('common.refreshing') : t('common.refresh') }}
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
          {{ t('common.loading_bugs') }}
        </p>
      </div>

      <!-- Bug List -->
      <div v-else class="grid gap-4">
        <TransitionGroup name="list">
          <div
            v-for="issue in issues"
            :key="issue.key"
            class="card group relative overflow-hidden cursor-pointer"
            @click="openDetail(issue.key)"
          >
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
                    {{ issue.fields.assignee?.displayName || t('detail.unassigned') }}
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
              <div class="flex flex-col justify-center gap-2 min-w-140px" @click.stop>
                <!-- 列表页暂时保留硬编码或根据状态显示最常用的（Jira 列表通常不放流转，这里保留之前的逻辑但加上错误处理） -->
                <p class="text-[10px] uppercase tracking-widest text-gray-600 font-bold mb-1">
                  {{ t('common.actions') }}
                </p>
                <div class="flex flex-wrap md:flex-col gap-2">
                  <button
                    v-if="['To Do', 'Open', '待办', '开放'].includes(issue.fields.status.name)"
                    class="px-3 py-1.5 text-xs rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 hover:bg-yellow-500 hover:text-black transition-all flex items-center gap-2 disabled:opacity-50"
                    :disabled="updatingKeys.has(issue.key)"
                    @click="handleTransition(issue.key, '11')"
                  >
                    <div v-if="updatingKeys.has(issue.key)" class="i-tabler-loader-2 animate-spin" />
                    <div v-else class="i-tabler-player-play" /> {{ t('actions.start_progress') }}
                  </button>
                  <button
                    v-if="['In Progress', '处理中', '进行中'].includes(issue.fields.status.name)"
                    class="px-3 py-1.5 text-xs rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500 hover:text-black transition-all flex items-center gap-2 disabled:opacity-50"
                    :disabled="updatingKeys.has(issue.key)"
                    @click="handleTransition(issue.key, '21')"
                  >
                    <div v-if="updatingKeys.has(issue.key)" class="i-tabler-loader-2 animate-spin" />
                    <div v-else class="i-tabler-check" /> {{ t('actions.resolve') }}
                  </button>
                  <button
                    v-if="['Resolved', '已解决'].includes(issue.fields.status.name)"
                    class="px-3 py-1.5 text-xs rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500 hover:text-black transition-all flex items-center gap-2 disabled:opacity-50"
                    :disabled="updatingKeys.has(issue.key)"
                    @click="handleTransition(issue.key, '31')"
                  >
                    <div v-if="updatingKeys.has(issue.key)" class="i-tabler-loader-2 animate-spin" />
                    <div v-else class="i-tabler-test-pipe" /> {{ t('actions.start_testing') }}
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
          {{ t('common.no_bugs') }}
        </h3>
        <p class="text-gray-600">
          {{ t('common.all_caught_up') }}
        </p>
      </div>
    </div>

    <!-- Detail Modal -->
    <Transition name="fade">
      <div v-if="selectedIssueKey" class="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="closeDetail" />

        <!-- Modal Content -->
        <div class="relative bg-gray-900 border border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">
          <!-- Modal Header -->
          <div class="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
            <div class="flex items-center gap-4">
              <span class="text-lg font-mono font-bold text-teal-500 bg-teal-500/10 px-3 py-1 rounded">
                {{ selectedIssueKey }}
              </span>
              <div v-if="isDetailFetching" class="i-tabler-loader-2 animate-spin text-teal-500" />
            </div>
            <button class="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400" @click="closeDetail">
              <div class="i-tabler-x text-2xl" />
            </button>
          </div>

          <!-- Modal Body -->
          <div v-if="selectedIssue" class="flex-1 overflow-y-auto p-6 md:p-10 text-left">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <!-- Left Column: Content -->
              <div class="lg:col-span-2 space-y-10">
                <section>
                  <h2 class="text-3xl font-extrabold text-white mb-6 leading-tight tracking-tight">
                    {{ selectedIssue.fields.summary }}
                  </h2>
                  <div class="prose prose-invert max-w-none">
                    <p v-if="cleanedDescription" class="text-gray-400 whitespace-pre-wrap leading-relaxed text-base">
                      {{ cleanedDescription }}
                    </p>
                    <p v-else class="text-gray-600 italic">
                      {{ t('detail.no_description') }}
                    </p>
                  </div>
                </section>

                <!-- Attachments Section -->
                <section v-if="images.length || otherFiles.length" class="space-y-6 pt-6 border-t border-gray-800">
                  <h4 class="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                    <div class="i-tabler-paperclip" />
                    {{ t('detail.attachments') }} ({{ selectedIssue.fields.attachment?.length }})
                  </h4>

                  <!-- Image Gallery -->
                  <div v-if="images.length" class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div
                      v-for="img in images"
                      :key="img.id"
                      class="group relative aspect-video bg-gray-800 rounded-xl overflow-hidden border border-gray-700/50 cursor-zoom-in"
                      @click="openPreview(img.content)"
                    >
                      <div class="absolute inset-0 flex items-center justify-center">
                        <div class="i-tabler-photo text-3xl text-gray-700" />
                      </div>
                      <!-- 实际图片预览 -->
                      <img
                        v-if="imageThumbnails[img.thumbnail || img.content]"
                        :src="imageThumbnails[img.thumbnail || img.content]"
                        class="absolute inset-0 w-full h-full object-cover"
                      >
                      <div class="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                      <div class="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <p class="text-[10px] text-white truncate">
                          {{ img.filename }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Other Files -->
                  <div v-if="otherFiles.length" class="space-y-2">
                    <a
                      v-for="file in otherFiles"
                      :key="file.id"
                      :href="jira.resolveUrl(file.content)"
                      target="_blank"
                      class="flex items-center gap-3 p-3 bg-gray-800/30 border border-gray-800 rounded-xl hover:bg-gray-800/50 hover:border-gray-700 transition-all group"
                    >
                      <div class="i-tabler-file text-gray-500 group-hover:text-teal-400" />
                      <div class="flex-1 min-w-0">
                        <p class="text-sm text-gray-300 truncate">
                          {{ file.filename }}
                        </p>
                        <p class="text-[10px] text-gray-600">
                          {{ (file.size / 1024).toFixed(1) }} KB
                        </p>
                      </div>
                      <div class="i-tabler-download text-gray-600 opacity-0 group-hover:opacity-100" />
                    </a>
                  </div>
                </section>

                <section v-if="selectedIssue.fields.comment?.comments.length" class="space-y-6">
                  <h4 class="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                    <div class="i-tabler-messages" />
                    {{ t('detail.comments') }} ({{ selectedIssue.fields.comment.comments.length }})
                  </h4>
                  <div class="space-y-4">
                    <div v-for="comment in selectedIssue.fields.comment.comments" :key="comment.created" class="bg-gray-800/30 p-4 rounded-2xl border border-gray-800/50">
                      <div class="flex justify-between items-center mb-2">
                        <span class="font-bold text-teal-400 text-sm">{{ comment.author.displayName }}</span>
                        <span class="text-[10px] text-gray-600">{{ new Date(comment.created).toLocaleString() }}</span>
                      </div>
                      <p class="text-sm text-gray-300 leading-relaxed">
                        {{ comment.body }}
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              <!-- Right Column: Meta Info -->
              <div class="space-y-8">
                <div class="bg-gray-800/40 p-6 rounded-2xl border border-gray-800/50 space-y-6">
                  <div>
                    <p class="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold mb-3">
                      {{ t('detail.status') }}
                    </p>
                    <span class="px-3 py-1 rounded-full border text-xs font-medium inline-block" :class="getStatusClass(selectedIssue.fields.status.name)">
                      {{ selectedIssue.fields.status.name }}
                    </span>
                  </div>

                  <div>
                    <p class="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold mb-3">
                      {{ t('detail.priority') }}
                    </p>
                    <div class="flex items-center gap-2 text-gray-300 text-sm font-medium">
                      <div class="i-tabler-alert-triangle text-yellow-500" />
                      {{ selectedIssue.fields.priority.name }}
                    </div>
                  </div>

                  <div>
                    <p class="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold mb-3">
                      {{ t('detail.assignee') }}
                    </p>
                    <div class="flex items-center gap-3 text-gray-300 text-sm font-medium">
                      <div class="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-500 font-bold text-xs">
                        {{ selectedIssue.fields.assignee?.displayName.charAt(0) || 'U' }}
                      </div>
                      {{ selectedIssue.fields.assignee?.displayName || t('detail.unassigned') }}
                    </div>
                  </div>

                  <div class="pt-6 border-t border-gray-800/50 space-y-4 text-[11px] text-gray-500">
                    <div class="flex justify-between items-center">
                      <span class="opacity-60">{{ t('detail.created') }}</span>
                      <span class="text-gray-400 font-mono">{{ new Date(selectedIssue.fields.created).toLocaleString() }}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="opacity-60">{{ t('detail.updated') }}</span>
                      <span class="text-gray-400 font-mono">{{ new Date(selectedIssue.fields.updated).toLocaleString() }}</span>
                    </div>
                  </div>
                </div>

                <!-- Modal Actions -->
                <div class="space-y-4 px-2">
                  <p class="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">
                    {{ t('detail.quick_transitions') }}
                  </p>
                  <div class="grid grid-cols-1 gap-2.5">
                    <div v-if="isTransitionsFetching" class="flex items-center justify-center py-4">
                      <div class="i-tabler-loader-2 animate-spin text-gray-600" />
                    </div>
                    <button
                      v-for="t in transitions"
                      :key="t.id"
                      class="px-4 py-2.5 text-sm rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500 hover:text-black transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      :disabled="updatingKeys.has(selectedIssue.key)"
                      @click="handleTransition(selectedIssue.key, t.id)"
                    >
                      <div v-if="updatingKeys.has(selectedIssue.key)" class="i-tabler-loader-2 animate-spin" />
                      <div v-else class="i-tabler-arrow-right" />
                      {{ t.name }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Image Preview Lightbox -->
    <Transition name="fade">
      <div v-if="previewImageUrl" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl" @click="closePreview">
        <div class="absolute top-6 right-6 flex items-center gap-4">
          <button class="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white" @click.stop="closePreview">
            <div class="i-tabler-x text-2xl" />
          </button>
        </div>

        <div v-if="previewImageUrl === 'loading'" class="flex flex-col items-center gap-4">
          <div class="i-tabler-loader-2 text-5xl text-teal-500 animate-spin" />
          <p class="text-teal-500 font-bold animate-pulse">
            {{ t('detail.loading_high_res') }}
          </p>
        </div>
        <img v-else :src="previewImageUrl" class="max-w-[95vw] max-h-[95vh] object-contain shadow-2xl rounded-lg" @click.stop>
      </div>
    </Transition>
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
