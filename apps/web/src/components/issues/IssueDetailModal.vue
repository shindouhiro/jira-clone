<script setup lang="ts">
import type { JiraIssue, JiraTransition, JiraUser } from '@jira/shared'
import type { JiraClient } from '@jira/shared'
import type { JiraAttachment } from '@/utils/issue'
import { ref, computed, watch } from 'vue'
import { useClipboard, onClickOutside, useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { formatDisplayName, formatIssueDateTime, getPriorityColorClass } from '@/utils/issue'

interface Props {
  issueKey: string | null
  issue: JiraIssue | null
  cleanedDescription: string
  images: JiraAttachment[]
  otherFiles: JiraAttachment[]
  imageThumbnails: Record<string, string>
  previewImageUrl: string | null
  isLoadingPreview: boolean
  transitions: JiraTransition[]
  isDetailFetching: boolean
  isTransitionsFetching: boolean
  updatingKeys: Set<string>
  getStatusClass: (status: string) => string
  resolveAttachmentUrl: (url: string) => string
  jira: JiraClient
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'openPreview', url: string): void
  (event: 'closePreview'): void
  (event: 'transition', issueKey: string, transitionIds: string): void
  (event: 'assign', issueKey: string, username: string | null): void
}>()

const { t } = useI18n()
const { copy, copied } = useClipboard()

const extractedUrls = computed(() => {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const matches = props.cleanedDescription.match(urlRegex)
  return matches ? [...new Set(matches)] : []
})

function copyToClipboard(text: string) {
  copy(text)
}

// 分配逻辑
const isAssignDropdownOpen = ref(false)
const userSearchQuery = ref('')
const assignableUsers = ref<JiraUser[]>([])
const isSearchingUsers = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

onClickOutside(dropdownRef, () => {
  isAssignDropdownOpen.value = false
})

const debouncedSearch = useDebounceFn(async (query: string) => {
  if (!props.issueKey)
    return
  isSearchingUsers.value = true
  try {
    const { data } = await props.jira.findAssignableUsers(props.issueKey, query)
    assignableUsers.value = data.value || []
  }
  catch (error) {
    console.error('Failed to search users:', error)
  }
  finally {
    isSearchingUsers.value = false
  }
}, 300)

watch(userSearchQuery, (query) => {
  void debouncedSearch(query)
})

function toggleAssignDropdown() {
  isAssignDropdownOpen.value = !isAssignDropdownOpen.value
  if (isAssignDropdownOpen.value) {
    userSearchQuery.value = ''
    void debouncedSearch('')
  }
}

function handleAssignUser(username: string | null) {
  if (!props.issueKey)
    return
  emit('assign', props.issueKey, username)
  isAssignDropdownOpen.value = false
}
</script>

<template>
  <Transition name="fade">
    <section
      v-if="issueKey"
      id="issue-detail-modal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-detail-title"
    >
      <button
        id="issue-detail-backdrop"
        class="absolute inset-0 bg-black/80 backdrop-blur-md"
        type="button"
        @click="emit('close')"
      />

      <article class="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">
        <header class="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
          <div class="flex items-center gap-4">
            <span class="text-lg font-mono font-bold text-teal-700 dark:text-teal-500 bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-transparent px-3 py-1 rounded-md shadow-sm dark:shadow-none">
              {{ issueKey }}
            </span>
            <div v-if="isDetailFetching" class="i-tabler-loader-2 animate-spin text-teal-500" />
          </div>
          <button
            id="issue-detail-close-button"
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
            type="button"
            @click="emit('close')"
          >
            <span class="sr-only">close detail modal</span>
            <div class="i-tabler-x text-2xl" />
          </button>
        </header>

        <div v-if="issue" class="flex-1 overflow-y-auto p-6 md:p-10 text-left">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <main class="lg:col-span-2 space-y-10">
              <section>
                <h2 id="issue-detail-title" class="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight tracking-tight">
                  {{ issue.fields.summary }}
                </h2>
                <div v-if="cleanedDescription" class="space-y-4">
                  <p class="text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed text-base">
                    {{ cleanedDescription }}
                  </p>
                  
                  <div v-if="extractedUrls.length" class="flex flex-wrap gap-2">
                    <button
                      v-for="url in extractedUrls"
                      :key="url"
                      class="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:text-teal-700 dark:hover:text-teal-400 hover:border-teal-200 dark:hover:border-teal-500/30 transition-all group"
                      type="button"
                      :title="t('common.copy_url') || 'Copy URL'"
                      @click="copyToClipboard(url)"
                    >
                      <span :class="copied ? 'i-tabler-check text-teal-500' : 'i-tabler-copy text-gray-400 group-hover:text-teal-500'" class="text-sm transition-colors" />
                      <span class="max-w-[250px] truncate">{{ url }}</span>
                    </button>
                  </div>
                </div>
                <p v-else class="text-gray-400 dark:text-gray-600 italic">
                  {{ t('detail.no_description') }}
                </p>
              </section>

              <section v-if="images.length || otherFiles.length" class="space-y-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                <h3 class="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <span class="i-tabler-paperclip" />
                  {{ t('detail.attachments') }} ({{ issue.fields.attachment?.length || 0 }})
                </h3>

                <div v-if="images.length" class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <button
                    v-for="image in images"
                    :id="`issue-attachment-image-${image.id}`"
                    :key="image.id"
                    type="button"
                    class="group relative aspect-video bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700/50 cursor-zoom-in shadow-sm dark:shadow-none"
                    @click="emit('openPreview', image.content)"
                  >
                    <div class="absolute inset-0 flex items-center justify-center">
                      <div class="i-tabler-photo text-3xl text-gray-200 dark:text-gray-700" />
                    </div>
                    <img
                      v-if="imageThumbnails[image.thumbnail || image.content]"
                      :src="imageThumbnails[image.thumbnail || image.content]"
                      :alt="image.filename"
                      width="400"
                      height="225"
                      loading="lazy"
                      class="absolute inset-0 w-full h-full object-cover"
                    >
                    <div class="absolute inset-0 bg-black/5 dark:bg-black/20 group-hover:bg-black/0 transition-colors" />
                    <div class="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <p class="text-[10px] text-white truncate text-left">
                        {{ image.filename }}
                      </p>
                    </div>
                  </button>
                </div>

                <div v-if="otherFiles.length" class="space-y-2">
                  <a
                    v-for="file in otherFiles"
                    :id="`issue-attachment-file-${file.id}`"
                    :key="file.id"
                    :href="resolveAttachmentUrl(file.content)"
                    target="_blank"
                    rel="noreferrer"
                    class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:border-gray-200 dark:hover:border-gray-700 transition group"
                  >
                    <span class="i-tabler-file text-gray-500 dark:text-gray-400 group-hover:text-teal-600 dark:group-hover:text-teal-400" />
                    <span class="flex-1 min-w-0">
                      <span class="block text-sm text-gray-700 dark:text-gray-300 truncate">
                        {{ file.filename }}
                      </span>
                      <span class="block text-[10px] text-gray-500 dark:text-gray-500 font-medium">
                        {{ (file.size / 1024).toFixed(1) }} KB
                      </span>
                    </span>
                    <span class="i-tabler-download text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100" />
                  </a>
                </div>
              </section>

              <section v-if="issue.fields.comment?.comments.length" class="space-y-6">
                <h3 class="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <span class="i-tabler-messages" />
                  {{ t('detail.comments') }} ({{ issue.fields.comment.comments.length }})
                </h3>
                <div class="space-y-4">
                  <article
                    v-for="comment in issue.fields.comment.comments"
                    :key="comment.created"
                    class="bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800/50 shadow-sm dark:shadow-none"
                  >
                    <header class="flex justify-between items-center mb-2">
                      <span class="font-bold text-teal-600 dark:text-teal-400 text-sm">{{ formatDisplayName(comment.author.displayName) }}</span>
                      <time class="text-[10px] text-gray-400 dark:text-gray-600 font-medium">{{ formatIssueDateTime(comment.created) }}</time>
                    </header>
                    <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                      {{ comment.body }}
                    </p>
                  </article>
                </div>
              </section>
            </main>

            <aside class="space-y-8">
              <section class="bg-gray-50 dark:bg-gray-800/40 p-6 rounded-2xl border border-gray-100 dark:border-gray-800/50 space-y-6 shadow-sm dark:shadow-none">
                <div>
                  <p class="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 font-bold mb-3">
                    {{ t('detail.status') }}
                  </p>
                  <span class="px-3 py-1 rounded-full border text-xs font-medium inline-block shadow-sm dark:shadow-none" :class="getStatusClass(issue.fields.status.name)">
                    {{ issue.fields.status.name }}
                  </span>
                </div>

                <div>
                  <p class="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 font-bold mb-3">
                    {{ t('detail.priority') }}
                  </p>
                  <div class="flex items-center gap-2 text-sm font-bold" :class="getPriorityColorClass(issue.fields.priority.name)">
                    <span class="i-tabler-alert-triangle" />
                    {{ issue.fields.priority.name }}
                  </div>
                </div>

                <div>
                  <p class="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 font-bold mb-3">
                    {{ t('detail.assignee') }}
                  </p>
                  <div class="flex items-center justify-between group/assignee">
                    <div class="flex items-center gap-3 text-gray-700 dark:text-gray-300 text-sm font-bold">
                      <div class="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-500 font-black text-xs overflow-hidden">
                        <img
                          v-if="issue.fields.assignee?.avatarUrls?.['24x24']"
                          :src="resolveAttachmentUrl(issue.fields.assignee.avatarUrls['24x24'])"
                          :alt="issue.fields.assignee.displayName"
                          class="w-full h-full object-cover"
                        >
                        <span v-else>{{ issue.fields.assignee?.displayName.charAt(0) || 'U' }}</span>
                      </div>
                      {{ issue.fields.assignee?.displayName ? formatDisplayName(issue.fields.assignee.displayName) : t('detail.unassigned') }}
                    </div>

                    <div class="relative" ref="dropdownRef">
                      <button
                        id="issue-assign-button"
                        class="flex items-center gap-1.5 px-2 py-1 bg-teal-500/5 hover:bg-teal-500/15 dark:bg-teal-500/10 dark:hover:bg-teal-500/20 rounded-lg transition-all text-teal-600 dark:text-teal-400 border border-teal-500/10 hover:border-teal-500/30"
                        :class="{ 'ring-2 ring-teal-500/30 bg-teal-500/20': isAssignDropdownOpen }"
                        type="button"
                        @click="toggleAssignDropdown"
                      >
                        <div class="i-tabler-user-edit text-sm" />
                        <span class="text-[10px] font-bold uppercase tracking-wider">{{ t('actions.assign') }}</span>
                      </button>

                      <Transition name="fade">
                        <div
                          v-if="isAssignDropdownOpen"
                          class="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl z-20 overflow-hidden backdrop-blur-xl"
                        >
                          <div class="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                            <div class="relative">
                              <div class="absolute left-2.5 top-1/2 -translate-y-1/2 i-tabler-search text-gray-400 text-sm" />
                              <input
                                v-model="userSearchQuery"
                                type="text"
                                class="w-full bg-white dark:bg-gray-800 border-none rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-teal-500/50 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-inner"
                                :placeholder="t('actions.search_user') || 'Search users...'"
                                autofocus
                              >
                            </div>
                          </div>
                          <div class="max-h-60 overflow-y-auto p-1 bg-white dark:bg-gray-900">
                            <button
                              class="w-full flex items-center gap-3 p-2 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition text-left group"
                              type="button"
                              @click="handleAssignUser(null)"
                            >
                              <div class="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                                <div class="i-tabler-user-off text-xs" />
                              </div>
                              <span class="text-xs font-bold text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                                {{ t('detail.unassigned') }}
                              </span>
                            </button>

                            <div v-if="isSearchingUsers" class="flex items-center justify-center py-4">
                              <div class="i-tabler-loader-2 animate-spin text-teal-500 text-sm" />
                            </div>
                            
                            <template v-else>
                              <button
                                v-for="user in assignableUsers"
                                :key="user.name"
                                class="w-full flex items-center gap-3 p-2 bg-transparent hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-xl transition text-left group"
                                type="button"
                                @click="handleAssignUser(user.name)"
                              >
                                <div class="w-7 h-7 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400 overflow-hidden ring-1 ring-teal-500/20 group-hover:ring-teal-500/40 transition-all">
                                  <img
                                    v-if="user.avatarUrls?.['24x24']"
                                    :src="resolveAttachmentUrl(user.avatarUrls['24x24'])"
                                    :alt="user.displayName"
                                    class="w-full h-full object-cover"
                                  >
                                  <span v-else>{{ user.displayName.charAt(0) }}</span>
                                </div>
                                <span class="text-xs font-bold text-gray-800 dark:text-gray-200 group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
                                  {{ formatDisplayName(user.displayName) }}
                                </span>
                              </button>
                              <p v-if="assignableUsers.length === 0" class="text-center py-4 text-[10px] text-gray-400 font-medium">
                                {{ t('actions.no_users_found') || 'No users found' }}
                              </p>
                            </template>
                          </div>
                        </div>
                      </Transition>
                    </div>
                  </div>
                </div>

                <dl class="pt-6 border-t border-gray-200 dark:border-gray-800/50 space-y-4 text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                  <div class="flex justify-between items-center">
                    <dt class="opacity-60">
                      {{ t('detail.created') }}
                    </dt>
                    <dd class="text-gray-500 dark:text-gray-400 font-mono">
                      {{ formatIssueDateTime(issue.fields.created) }}
                    </dd>
                  </div>
                  <div class="flex justify-between items-center">
                    <dt class="opacity-60">
                      {{ t('detail.updated') }}
                    </dt>
                    <dd class="text-gray-500 dark:text-gray-400 font-mono">
                      {{ formatIssueDateTime(issue.fields.updated) }}
                    </dd>
                  </div>
                </dl>
              </section>

              <section class="space-y-4 px-2">
                <p class="text-[10px] uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 font-black">
                  {{ t('detail.quick_transitions') }}
                </p>
                <div class="grid grid-cols-1 gap-2.5">
                  <div v-if="isTransitionsFetching" class="flex items-center justify-center py-4">
                    <div class="i-tabler-loader-2 animate-spin text-gray-400 dark:text-gray-600" />
                  </div>
                  <button
                    v-for="transitionItem in transitions"
                    :id="`issue-detail-transition-${issue.key}-${transitionItem.id}`"
                    :key="transitionItem.id"
                    class="px-4 py-2.5 text-sm rounded-xl bg-white dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-500/20 hover:bg-teal-50 dark:hover:bg-teal-500 hover:text-teal-700 dark:hover:text-black shadow-sm dark:shadow-none transition flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                    :disabled="updatingKeys.has(issue.key)"
                    type="button"
                    @click="emit('transition', issue.key, transitionItem.id)"
                  >
                    <div v-if="updatingKeys.has(issue.key)" class="i-tabler-loader-2 animate-spin" />
                    <div v-else class="i-tabler-arrow-right" />
                    {{ transitionItem.name }}
                  </button>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </article>

      <Transition name="fade">
        <div
          v-if="previewImageUrl"
          id="issue-preview-overlay"
          class="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl"
          @click="emit('closePreview')"
        >
          <div class="absolute top-6 right-6 flex items-center gap-4">
            <button
              id="issue-preview-close-button"
              class="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
              type="button"
              @click.stop="emit('closePreview')"
            >
              <span class="sr-only">close image preview</span>
              <div class="i-tabler-x text-2xl" />
            </button>
          </div>

          <div v-if="previewImageUrl === 'loading' || isLoadingPreview" class="flex flex-col items-center gap-4">
            <div class="i-tabler-loader-2 text-5xl text-teal-500 animate-spin" />
            <p class="text-teal-500 font-bold animate-pulse">
              {{ t('detail.loading_high_res') }}
            </p>
          </div>
          <img
            v-else
            id="issue-preview-image"
            :src="previewImageUrl"
            alt="Issue attachment preview"
            width="1200"
            height="800"
            loading="lazy"
            class="max-w-[95vw] max-h-[95vh] object-contain shadow-2xl rounded-lg"
            @click.stop
          >
        </div>
      </Transition>
    </section>
  </Transition>
</template>
