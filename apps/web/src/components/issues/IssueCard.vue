<script setup lang="ts">
import type { JiraIssue } from '@jira/shared'
import type { QuickTransitionAction } from '@/utils/issue'
import { useI18n } from 'vue-i18n'
import { formatIssueDate } from '@/utils/issue'

interface Props {
  issue: JiraIssue
  isUpdating: boolean
  statusClass: string
  quickActions: QuickTransitionAction[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (event: 'openDetail', issueKey: string): void
  (event: 'transition', issueKey: string, transitionIds: string): void
}>()

const { t } = useI18n()

function openDetail() {
  emit('openDetail', props.issue.key)
}

function runTransition(transitionIds: string) {
  emit('transition', props.issue.key, transitionIds)
}
</script>

<template>
  <article
    :id="`issue-card-${issue.key}`"
    class="card group relative overflow-hidden cursor-pointer"
    role="button"
    tabindex="0"
    @click="openDetail"
    @keydown.enter="openDetail"
    @keydown.space.prevent="openDetail"
  >
    <div v-if="isUpdating" class="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center">
      <div class="i-tabler-loader-2 text-3xl text-teal-500 animate-spin" />
    </div>

    <div class="flex flex-col md:flex-row justify-between gap-6">
      <section class="flex-1">
        <header class="flex items-center gap-3 mb-3">
          <span class="text-sm font-mono font-bold text-teal-700 dark:text-teal-500 bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-transparent px-2.5 py-0.5 rounded-md">
            {{ issue.key }}
          </span>
          <span class="text-xs px-2.5 py-0.5 rounded-full border shadow-sm dark:shadow-none font-medium" :class="statusClass">
            {{ issue.fields.status.name }}
          </span>
        </header>

        <h2 class="text-xl font-bold text-gray-800 dark:text-white mb-4 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
          {{ issue.fields.summary }}
        </h2>

        <ul class="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 font-medium">
          <li class="flex items-center gap-1.5">
            <span class="i-tabler-user text-gray-500 dark:text-gray-400" />
            <span>{{ issue.fields.assignee?.displayName || t('detail.unassigned') }}</span>
          </li>
          <li class="flex items-center gap-1.5">
            <span class="i-tabler-alert-triangle text-gray-500 dark:text-gray-400" />
            <span>{{ issue.fields.priority.name }}</span>
          </li>
          <li class="flex items-center gap-1.5">
            <span class="i-tabler-calendar text-gray-500 dark:text-gray-400" />
            <span>{{ formatIssueDate(issue.fields.created) }}</span>
          </li>
        </ul>
      </section>

      <aside class="flex flex-col justify-center gap-2 min-w-140px" @click.stop>
        <p class="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 font-bold mb-1">
          {{ t('common.actions') }}
        </p>
        <div class="flex flex-wrap md:flex-col gap-2">
          <button
            v-for="action in quickActions"
            :id="`issue-action-${issue.key}-${action.key}`"
            :key="action.key"
            class="px-3 py-1.5 text-xs rounded-lg border shadow-sm dark:shadow-none transition-all flex items-center gap-2 font-bold disabled:opacity-50"
            :class="action.className"
            :disabled="isUpdating"
            type="button"
            @click="runTransition(action.transitionIds)"
          >
            <div v-if="isUpdating" class="i-tabler-loader-2 animate-spin" />
            <div v-else :class="action.iconClass" />
            {{ action.label }}
          </button>
        </div>
      </aside>
    </div>
  </article>
</template>
