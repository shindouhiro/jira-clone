<script setup lang="ts">
import type { JiraIssue } from '@jira/shared'
import type { QuickTransitionAction } from '@/utils/issue'
import { useI18n } from 'vue-i18n'
import { formatIssueDate, getPriorityColorClass } from '@/utils/issue'

interface Props {
  issue: JiraIssue
  isUpdating: boolean
  isInTodo: boolean
  statusClass: string
  quickActions: QuickTransitionAction[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (event: 'openDetail', issueKey: string): void
  (event: 'transition', issueKey: string, transitionIds: string): void
  (event: 'toggleTodo', issueKey: string): void
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
            <span class="i-tabler-alert-triangle" :class="getPriorityColorClass(issue.fields.priority.name)" />
            <span :class="getPriorityColorClass(issue.fields.priority.name)">{{ issue.fields.priority.name }}</span>
          </li>
          <li class="flex items-center gap-1.5">
            <span class="i-tabler-calendar text-gray-500 dark:text-gray-400" />
            <span>{{ formatIssueDate(issue.fields.created) }}</span>
          </li>
        </ul>
      </section>

      <aside class="flex flex-col justify-center gap-2 items-end min-w-80px" @click.stop>
        <p class="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 font-bold mb-1 mr-1">
          {{ t('common.actions') }}
        </p>
        <div class="flex flex-wrap md:flex-col gap-2 items-end">
          <button
            v-for="action in quickActions"
            :id="`issue-action-${issue.key}-${action.key}`"
            :key="action.key"
            class="px-3 py-1.5 text-xs shadow-sm dark:shadow-none transition flex items-center justify-center gap-2 font-bold disabled:opacity-50 min-w-72px"
            :class="action.className"
            :disabled="isUpdating"
            type="button"
            @click="runTransition(action.transitionIds)"
          >
            <div v-if="isUpdating" class="i-tabler-loader-2 animate-spin" />
            <div v-else :class="action.iconClass" />
            {{ action.label }}
          </button>

          <button
            :id="`issue-todo-${issue.key}`"
            class="px-3 py-1.5 text-xs shadow-sm dark:shadow-none transition flex items-center justify-center gap-2 font-bold backdrop-blur-sm rounded-lg border min-w-72px"
            :class="isInTodo 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20' 
              : 'bg-gray-50/80 dark:bg-gray-500/5 border-gray-200 dark:border-gray-500/30 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-500/10'"
            type="button"
            @click="emit('toggleTodo', issue.key)"
          >
            <div :class="isInTodo ? 'i-tabler-star-filled text-amber-500' : 'i-tabler-star'" />
            {{ isInTodo ? (t('actions.in_todo') || 'In Todo') : (t('actions.add_todo') || 'Add Todo') }}
          </button>

          <button
            :id="`issue-assign-${issue.key}`"
            class="px-3 py-1.5 text-xs shadow-sm dark:shadow-none transition flex items-center justify-center gap-2 font-bold backdrop-blur-sm bg-teal-50/80 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 text-teal-700 dark:text-teal-300 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-500/20 dark:hover:border-teal-400 dark:hover:text-teal-200 hover:shadow-[0_0_15px_rgba(20,184,166,0.2)] active:scale-95 min-w-72px"
            type="button"
            :disabled="isUpdating"
            @click="openDetail"
          >
            <div class="i-tabler-user-edit" />
            {{ t('actions.assign') }}
          </button>
        </div>
      </aside>
    </div>
  </article>
</template>
