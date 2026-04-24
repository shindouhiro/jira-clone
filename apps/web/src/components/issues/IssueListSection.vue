<script setup lang="ts">
import type { JiraIssue } from '@jira/shared'
import type { QuickTransitionAction } from '@/utils/issue'
import { useI18n } from 'vue-i18n'
import IssueCard from './IssueCard.vue'

interface Props {
  issues: JiraIssue[]
  isFetching: boolean
  updatingKeys: Set<string>
  getStatusClass: (status: string) => string
  getQuickActions: (status: string) => QuickTransitionAction[]
}

defineProps<Props>()

const emit = defineEmits<{
  (event: 'openDetail', issueKey: string): void
  (event: 'transition', issueKey: string, transitionIds: string): void
}>()

const { t } = useI18n()

function forwardTransition(issueKey: string, transitionIds: string) {
  emit('transition', issueKey, transitionIds)
}
</script>

<template>
  <section id="issue-list-section" aria-label="Issue list" class="space-y-4">
    <div v-if="isFetching && issues.length === 0" id="issue-list-loading" class="flex flex-col items-center justify-center py-20 gap-4" role="status" aria-live="polite">
      <div class="i-tabler-loader-2 text-5xl text-teal-500 animate-spin" />
      <p class="text-gray-500 animate-pulse">
        {{ t('common.loading_bugs') }}
      </p>
    </div>

    <div v-else-if="issues.length > 0" id="issue-list-content" class="grid gap-4">
      <TransitionGroup name="list" tag="div">
        <IssueCard
          v-for="issue in issues"
          :key="issue.key"
          :issue="issue"
          :is-updating="updatingKeys.has(issue.key)"
          :status-class="getStatusClass(issue.fields.status.name)"
          :quick-actions="getQuickActions(issue.fields.status.name)"
          @open-detail="emit('openDetail', $event)"
          @transition="forwardTransition"
        />
      </TransitionGroup>
    </div>

    <div
      v-else
      id="issue-list-empty"
      class="text-center py-20 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-3xl"
      role="status"
      aria-live="polite"
    >
      <div class="i-tabler-mood-empty text-5xl text-gray-300 dark:text-gray-700 mx-auto mb-4" />
      <h3 class="text-xl font-bold text-gray-400 dark:text-gray-500">
        {{ t('common.no_bugs') }}
      </h3>
      <p class="text-gray-400 dark:text-gray-600">
        {{ t('common.all_caught_up') }}
      </p>
    </div>
  </section>
</template>
