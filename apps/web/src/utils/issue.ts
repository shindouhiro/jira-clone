import type { JiraIssue } from '@jira/shared'

export type JiraAttachment = NonNullable<JiraIssue['fields']['attachment']>[number]

export interface QuickTransitionAction {
  key: string
  label: string
  transitionIds: string
  iconClass: string
  className: string
}

const IMAGE_EXTENSION_REGEX = /\.(?:png|jpe?g|gif|webp|bmp|svg)$/i

const statusColors: Record<string, string> = {
  'To Do': 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/50',
  'In Progress': 'bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/50',
  'Done': 'bg-green-50 text-green-600 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/50',
  'Resolved': 'bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-500/20 dark:text-teal-400 dark:border-teal-500/50',
  'Fixed': 'bg-green-50 text-green-600 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/50',
  'Open': 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/50',
  'Reopened': 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/50',
  '待办': 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/50',
  '处理中': 'bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/50',
  '进行中': 'bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/50',
  '已完成': 'bg-green-50 text-green-600 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/50',
  '已解决': 'bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-500/20 dark:text-teal-400 dark:border-teal-500/50',
  '已修复': 'bg-green-50 text-green-600 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/50',
  '开放': 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/50',
  '再次打开': 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/50',
}

const openedStatuses = new Set(['To Do', 'Open', '待办', '开放'])
const reopenedStatuses = new Set(['Reopened', '再次打开'])
const inProgressStatuses = new Set(['In Progress', '处理中', '进行中'])
const resolvedStatuses = new Set(['Resolved', '已解决'])

export function getStatusClass(status: string) {
  return statusColors[status] || 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/50'
}

export function isImageAttachment(attachment: JiraAttachment) {
  return attachment.mimeType.startsWith('image/') || IMAGE_EXTENSION_REGEX.test(attachment.filename)
}

export function cleanJiraDescription(description?: string) {
  if (!description)
    return ''
  return description.replace(/!.*?!/g, '').trim()
}

export function resolveQuickActions(statusName: string, t: (key: string) => string): QuickTransitionAction[] {
  if (openedStatuses.has(statusName) || reopenedStatuses.has(statusName)) {
    const transitionIds = reopenedStatuses.has(statusName) ? '51,21' : '11,21'
    return [{
      key: 'resolve-directly',
      label: t('actions.resolve_directly'),
      transitionIds,
      iconClass: 'i-tabler-player-play',
      className: 'backdrop-blur-sm bg-amber-50/80 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/40 text-amber-600 dark:text-amber-400 rounded-lg px-3 py-1.5 transition duration-300 hover:bg-amber-100 dark:hover:bg-amber-500/15 dark:hover:border-amber-400 dark:hover:text-amber-300 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)] active:scale-95',
    }]
  }

  if (inProgressStatuses.has(statusName)) {
    return [{
      key: 'resolve',
      label: t('actions.resolve'),
      transitionIds: '21',
      iconClass: 'i-tabler-check',
      className: 'backdrop-blur-sm bg-green-50/80 dark:bg-green-500/5 border border-green-200 dark:border-green-500/40 text-green-600 dark:text-green-400 rounded-lg px-3 py-1.5 transition duration-300 hover:bg-green-100 dark:hover:bg-green-500/15 dark:hover:border-green-400 dark:hover:text-green-300 hover:shadow-[0_0_15px_rgba(34,197,94,0.15)] active:scale-95',
    }]
  }

  if (resolvedStatuses.has(statusName)) {
    return [{
      key: 'start-testing',
      label: t('actions.start_testing'),
      transitionIds: '31',
      iconClass: 'i-tabler-test-pipe',
      className: 'backdrop-blur-sm bg-blue-50/80 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/40 text-blue-600 dark:text-blue-400 rounded-lg px-3 py-1.5 transition duration-300 hover:bg-blue-100 dark:hover:bg-blue-500/15 dark:hover:border-blue-400 dark:hover:text-blue-300 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)] active:scale-95',
    }]
  }

  return []
}

export function formatIssueDate(value: string) {
  return new Date(value).toLocaleDateString()
}

export function formatIssueDateTime(value: string) {
  return new Date(value).toLocaleString()
}

export function getPriorityColorClass(priorityName?: string) {
  const name = (priorityName || '').toLowerCase()
  if (name.includes('high') || name === '最高' || name === '高' || name === '严重' || name.includes('critical'))
    return 'text-red-500 dark:text-red-400'
  if (name.includes('medium') || name === '中')
    return 'text-amber-500 dark:text-amber-400'
  if (name.includes('low') || name === '最低' || name === '低' || name.includes('minor'))
    return 'text-teal-500 dark:text-teal-400'
  return 'text-gray-500 dark:text-gray-400'
}

export function formatDisplayName(displayName?: string) {
  if (!displayName)
    return ''
  return displayName === '吴伟东' ? 'Shindou' : displayName
}
