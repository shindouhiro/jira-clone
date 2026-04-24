<script setup lang="ts">
import type { JiraIssue } from '@jira/shared'
import type { QuickTransitionAction } from '@/utils/issue'

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
    class="group relative cursor-pointer overflow-hidden card"
    role="button"
    tabindex="0"
    @click="openDetail"
    @keydown.enter="openDetail"
    @keydown.space.prevent="openDetail"
  >
    <div v-if="isUpdating" class="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div class="i-tabler-loader-2 animate-spin text-3xl text-teal-500" />
    </div>

    <div class="flex flex-col justify-between gap-6 md:flex-row">
      <section class="flex-1">
        <header class="mb-3 flex items-center gap-3">
          <span class="border border-teal-100 rounded-md bg-teal-50 px-2.5 py-0.5 text-sm text-teal-700 font-bold font-mono dark:border-transparent dark:bg-teal-500/10 dark:text-teal-500">
            {{ issue.key }}
          </span>
          <span class="border rounded-full px-2.5 py-0.5 text-xs font-medium shadow-sm dark:shadow-none" :class="statusClass">
            {{ issue.fields.status.name }}
          </span>
        </header>

        <h2 class="mb-4 text-xl text-gray-800 font-bold transition-colors dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400">
          {{ issue.fields.summary }}
        </h2>

        <ul class="flex flex-wrap gap-4 text-sm text-gray-500 font-medium dark:text-gray-400">
          <li class="flex items-center gap-1.5">
            <span class="i-tabler-user text-gray-500 dark:text-gray-400" />
            <span>{{ issue.fields.assignee?.displayName ? formatDisplayName(issue.fields.assignee.displayName) : t('detail.unassigned') }}</span>
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

      <aside class="min-w-80px flex flex-col items-end justify-center gap-2" @click.stop>
        <p class="mb-1 mr-1 text-[10px] text-gray-500 font-bold tracking-widest uppercase dark:text-gray-600">
          {{ t('common.actions') }}
        </p>
        <div class="flex flex-wrap items-end gap-2 md:flex-col">
          <button
            v-for="action in quickActions"
            :id="`issue-action-${issue.key}-${action.key}`"
            :key="action.key"
            class="min-w-72px flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold shadow-sm transition disabled:opacity-50 dark:shadow-none"
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
            class="min-w-72px flex items-center justify-center gap-2 border rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm backdrop-blur-sm transition dark:shadow-none"
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
            class="min-w-72px flex items-center justify-center gap-2 border border-teal-200 rounded-lg bg-teal-50/80 px-3 py-1.5 text-xs text-teal-700 font-bold shadow-sm backdrop-blur-sm transition active:scale-95 dark:border-teal-500/30 dark:bg-teal-500/10 hover:bg-teal-100 dark:text-teal-300 dark:shadow-none hover:shadow-[0_0_15px_rgba(20,184,166,0.2)] dark:hover:border-teal-400 dark:hover:bg-teal-500/20 dark:hover:text-teal-200"
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
