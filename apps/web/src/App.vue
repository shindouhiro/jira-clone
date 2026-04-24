<script setup lang="ts">
import { useDark, useToggle } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DashboardHeader from '@/components/issues/DashboardHeader.vue'
import IssueDetailModal from '@/components/issues/IssueDetailModal.vue'
import IssueListSection from '@/components/issues/IssueListSection.vue'
import { useIssueAttachments } from '@/composables/useIssueAttachments'
import { useJiraDashboard } from '@/composables/useJiraDashboard'
import { cleanJiraDescription, getStatusClass, resolveQuickActions } from '@/utils/issue'

const username = 'wuweidong'
const password = 'Wu83609045@'

const { t, locale } = useI18n()

const isDark = useDark()
const toggleDark = useToggle(isDark)

function toggleLanguage() {
  locale.value = locale.value === 'zh' ? 'en' : 'zh'
}

const dashboard = useJiraDashboard({
  username,
  password,
  t,
})

const {
  jira,
  projectFilter,
  unresolvedOnly,
  selectedIssueKey,
  myProjects,
  isInitialLoading,
  issues,
  isFetching,
  fetchBugs,
  selectedIssue,
  isDetailFetching,
  transitions,
  isTransitionsFetching,
  openDetail,
  closeDetail,
  errorMessage,
  updatingKeys,
  transitionError,
  handleTransition,
} = dashboard

const attachments = useIssueAttachments({
  jira,
  issue: selectedIssue,
})

const {
  images,
  otherFiles,
  imageThumbnails,
  previewImageUrl,
  isLoadingPreview,
  openPreview,
  closePreview,
} = attachments

const cleanedDescription = computed(() => cleanJiraDescription(selectedIssue.value?.fields.description))

function getQuickActions(status: string) {
  return resolveQuickActions(status, t)
}

function clearTransitionError() {
  transitionError.value = null
}

function resolveAttachmentUrl(url: string) {
  return jira.resolveUrl(url)
}

function updateProjectFilter(value: string) {
  projectFilter.value = value
}

function updateUnresolvedOnly(value: boolean) {
  unresolvedOnly.value = value
}

function refreshIssues() {
  void fetchBugs()
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] text-gray-800 dark:text-gray-200 p-6 md:p-12 font-sans selection:bg-teal-500/30 transition-colors duration-300">
    <div class="max-w-5xl mx-auto">
      <DashboardHeader
        :username="username"
        :locale="locale"
        :is-dark="isDark"
        :transition-error="transitionError"
        :project-filter="projectFilter"
        :unresolved-only="unresolvedOnly"
        :my-projects="myProjects"
        :is-initial-loading="isInitialLoading"
        :is-refreshing="isFetching"
        @toggle-theme="toggleDark()"
        @toggle-language="toggleLanguage"
        @update:project-filter="updateProjectFilter"
        @update:unresolved-only="updateUnresolvedOnly"
        @refresh="refreshIssues"
        @clear-transition-error="clearTransitionError"
      />

      <Transition name="fade">
        <div
          v-if="errorMessage"
          id="issue-fetch-error"
          class="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3"
          role="status"
          aria-live="assertive"
        >
          <div class="i-tabler-alert-circle text-xl" />
          {{ errorMessage }}
        </div>
      </Transition>

      <main id="jira-dashboard-main" aria-label="Jira bug dashboard">
        <IssueListSection
          :issues="issues"
          :is-fetching="isFetching"
          :updating-keys="updatingKeys"
          :get-status-class="getStatusClass"
          :get-quick-actions="getQuickActions"
          @open-detail="openDetail"
          @transition="handleTransition"
        />
      </main>
    </div>

    <IssueDetailModal
      :issue-key="selectedIssueKey"
      :issue="selectedIssue"
      :cleaned-description="cleanedDescription"
      :images="images"
      :other-files="otherFiles"
      :image-thumbnails="imageThumbnails"
      :preview-image-url="previewImageUrl"
      :is-loading-preview="isLoadingPreview"
      :transitions="transitions"
      :is-detail-fetching="isDetailFetching"
      :is-transitions-fetching="isTransitionsFetching"
      :updating-keys="updatingKeys"
      :get-status-class="getStatusClass"
      :resolve-attachment-url="resolveAttachmentUrl"
      @close="closeDetail"
      @open-preview="openPreview"
      @close-preview="closePreview"
      @transition="handleTransition"
    />
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

body {
  margin: 0;
  @apply bg-white dark:bg-[#0a0a0a];
}

.btn {
  @apply px-4 py-1.5 rounded-xl bg-teal-600 text-white font-bold transition-all hover:bg-teal-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none;
}

.card {
  @apply bg-white dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800/50 p-6 rounded-3xl transition-all hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-none hover:border-teal-500/30 dark:hover:border-gray-700 shadow-sm dark:shadow-none;
}
</style>
