<script setup lang="ts">
import { useDark, useToggle } from '@vueuse/core'
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DashboardHeader from '@/components/issues/DashboardHeader.vue'
import IssueDetailModal from '@/components/issues/IssueDetailModal.vue'
import IssueListSection from '@/components/issues/IssueListSection.vue'
import ConfirmationModal from '@/components/common/ConfirmationModal.vue'
import { useIssueAttachments } from '@/composables/useIssueAttachments'
import { useJiraDashboard } from '@/composables/useJiraDashboard'
import { cleanJiraDescription, getStatusClass, resolveQuickActions } from '@/utils/issue'

const username = 'wuweidong'
const password = 'Wu83609045@'

const { t, locale } = useI18n()

// 确认弹窗状态
const confirmState = ref({
  show: false,
  title: '',
  message: '',
  issueKey: '',
  transitionIds: '',
})

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
  activeTab,
  toggleTodo,
  todoKeys,
  handleTransition: originalHandleTransition,
  handleAssign: originalHandleAssign,
} = dashboard

// 包装原有的流转逻辑，加入确认步骤
function handleTransitionWithConfirm(issueKey: string, transitionIds: string) {
  confirmState.value = {
    show: true,
    title: t('actions.confirm_transition_title'),
    message: t('actions.confirm_transition_message', { key: issueKey }),
    issueKey,
    transitionIds,
  }
}

function onConfirmTransition() {
  const { issueKey, transitionIds } = confirmState.value
  confirmState.value.show = false
  void originalHandleTransition(issueKey, transitionIds)
}

function onCancelTransition() {
  confirmState.value.show = false
}

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
        :active-tab="activeTab"
        @toggle-theme="toggleDark()"
        @toggle-language="toggleLanguage"
        @update:project-filter="updateProjectFilter"
        @update:unresolved-only="updateUnresolvedOnly"
        @update:active-tab="activeTab = $event"
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
          :todo-keys="todoKeys"
          :get-status-class="getStatusClass"
          :get-quick-actions="getQuickActions"
          @open-detail="openDetail"
          @transition="handleTransitionWithConfirm"
          @toggle-todo="toggleTodo"
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
      :jira="jira"
      @close="closeDetail"
      @open-preview="openPreview"
      @close-preview="closePreview"
      @transition="handleTransitionWithConfirm"
      @assign="originalHandleAssign"
    />

    <ConfirmationModal
      :show="confirmState.show"
      :title="confirmState.title"
      :message="confirmState.message"
      @confirm="onConfirmTransition"
      @cancel="onCancelTransition"
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
  transition: opacity 0.5s ease, transform 0.5s ease;
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
</style>
