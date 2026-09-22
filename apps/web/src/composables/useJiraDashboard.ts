import { JiraClient } from '@jira/shared'
import { useLocalStorage } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'
import { findTransitionByIntent, formatDisplayName, reopenedStatuses, resolvedStatuses } from '@/utils/issue'

export type DashboardTab = 'all' | 'reopened' | 'todo'

interface UseJiraDashboardOptions {
  username: string
  password: string
  t: (key: string) => string
}

export interface DashboardProject {
  key: string
  name: string
}

export function useJiraDashboard(options: UseJiraDashboardOptions) {
  const jira = new JiraClient(options.username, options.password)
  const openStatuses = new Set(['Open', '开放'])

  function sortIssuesOpenFirst<T extends { fields: { status: { name: string } } }>(items: T[]) {
    return [...items].sort((a, b) => {
      const aIsOpen = openStatuses.has(a.fields.status.name) ? 1 : 0
      const bIsOpen = openStatuses.has(b.fields.status.name) ? 1 : 0
      return bIsOpen - aIsOpen
    })
  }

  const projectFilter = ref('LMSSER')
  const unresolvedOnly = ref(false)
  const assigneeFilter = ref<string[]>(['currentUser()'])
  const priorityFilter = ref<string[]>([])
  const selectedIssueKey = ref<string | null>(null)
  const activeTab = useLocalStorage<DashboardTab>('jira-active-tab', 'all')

  const { data: projectsData, isFetching: isInitialLoading } = jira.getProjects()
  const { data: prioritiesData, isFetching: isPrioritiesLoading } = jira.getPriorities()

  const myProjects = computed<DashboardProject[]>(() => {
    return (projectsData.value || [])
      .map(project => ({
        key: project.key,
        name: project.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  const priorities = computed(() => {
    return (prioritiesData.value || []).map(p => ({
      ...p,
      iconUrl: jira.resolveUrl(p.iconUrl)
    }))
  })

  const { data: projectUsersData, isFetching: isUsersLoading } = jira.getProjectUsers(() => projectFilter.value)

  const projectUsers = computed(() => {
    return projectUsersData.value || []
  })

  const {
    data,
    error: fetchError,
    isFetching,
    execute: fetchBugs,
  } = jira.getBugs(
    () => projectFilter.value,
    () => unresolvedOnly.value,
    () => assigneeFilter.value,
    () => priorityFilter.value,
  )

  // 已成功流转的 issue key，立即从列表隐藏（不依赖 Jira API 刷新）
  const dismissedKeys = ref<Set<string>>(new Set())

  const allIssues = computed(() => {
    const fetchedIssues = data.value?.issues || []
    let filtered = fetchedIssues
    // 排除已成功流转的 issue（即时隐藏）
    if (dismissedKeys.value.size > 0) {
      filtered = filtered.filter(issue => !dismissedKeys.value.has(issue.key))
    }
    // 按 status 名称过滤已解决的 issue（兜底）
    if (unresolvedOnly.value) {
      filtered = filtered.filter(issue => !resolvedStatuses.has(issue.fields.status.name))
    }
    return sortIssuesOpenFirst(filtered)
  })

  // Todo List logic
  const todoKeys = useLocalStorage<string[]>('jira-todo-keys', [])
  
  function toggleTodo(issueKey: string) {
    const index = todoKeys.value.indexOf(issueKey)
    if (index > -1) {
      todoKeys.value.splice(index, 1)
    } else {
      todoKeys.value.push(issueKey)
    }
  }

  const todoIssues = computed(() => {
    return allIssues.value.filter(issue => todoKeys.value.includes(issue.key))
  })

  const reopenedIssues = computed(() => {
    return allIssues.value.filter(issue => reopenedStatuses.has(issue.fields.status.name))
  })

  const issues = computed(() => {
    if (activeTab.value === 'todo')
      return todoIssues.value
    if (activeTab.value === 'reopened')
      return reopenedIssues.value
    return allIssues.value
  })

  const {
    data: detailData,
    isFetching: isDetailFetching,
    execute: fetchDetail,
  } = jira.getIssueDetail(() => selectedIssueKey.value)

  const {
    data: transitionsData,
    isFetching: isTransitionsFetching,
    execute: fetchTransitions,
  } = jira.getTransitions(() => selectedIssueKey.value)

  const selectedIssue = computed(() => detailData.value || null)
  const transitions = computed(() => transitionsData.value?.transitions || [])

  function openDetail(issueKey: string) {
    selectedIssueKey.value = issueKey
    void fetchDetail()
    void fetchTransitions()
  }

  function closeDetail() {
    selectedIssueKey.value = null
  }

  const errorMessage = computed(() => {
    if (!fetchError.value)
      return null
    return options.t('common.error_fetch')
  })

  const updatingKeys = ref<Set<string>>(new Set())
  const transitionError = ref<string | null>(null)
  const isExporting = shallowRef(false)
  const exportProgress = shallowRef(0)

  async function exportAllIssues(format: 'xlsx' | 'json' = 'xlsx') {
    if (isExporting.value)
      return

    isExporting.value = true
    exportProgress.value = 0
    transitionError.value = null

    // 固定本次导出的筛选条件，避免等待请求时切换项目导致文件名与数据不一致。
    const projectKey = projectFilter.value
    const assignees = [...assigneeFilter.value]

    try {
      const response = await jira.getAllAssignedIssues(projectKey, assignees)
      exportProgress.value = 5

      const { downloadIssuesXlsx, downloadIssuesJson } = await import('@/utils/exportIssues')

      const exportOptions = {
        projectKey,
        formatAssignee: formatDisplayName,
        loadImage: (url: string) => jira.getAttachmentBlob(url),
        onImageProgress(completed: number, total: number) {
          exportProgress.value = total === 0
            ? 90
            : 5 + Math.round((completed / total) * 85)
        },
      }

      if (format === 'xlsx') {
        await downloadIssuesXlsx(response.issues, exportOptions)
      }
      else {
        downloadIssuesJson(response.issues, exportOptions)
      }
      exportProgress.value = 100
    }
    catch (error) {
      transitionError.value = options.t('common.error_export') || `Export failed: ${String(error)}`
    }
    finally {
      isExporting.value = false
      exportProgress.value = 0
    }
  }

  async function exportSingleIssue(issueKey: string, format: 'xlsx' | 'json' = 'xlsx') {
    if (isExporting.value)
      return

    const issueToExport = allIssues.value.find(i => i.key === issueKey) || selectedIssue.value
    if (!issueToExport) return

    isExporting.value = true
    exportProgress.value = 0
    transitionError.value = null

    try {
      exportProgress.value = 5
      const { downloadIssuesXlsx, downloadIssuesJson } = await import('@/utils/exportIssues')

      const exportOptions = {
        projectKey: issueToExport.key,
        formatAssignee: formatDisplayName,
        loadImage: (url: string) => jira.getAttachmentBlob(url),
        onImageProgress(completed: number, total: number) {
          exportProgress.value = total === 0
            ? 90
            : 5 + Math.round((completed / total) * 85)
        },
      }

      if (format === 'xlsx') {
        await downloadIssuesXlsx([issueToExport], exportOptions)
      }
      else {
        downloadIssuesJson([issueToExport], exportOptions)
      }
      exportProgress.value = 100
    }
    catch (error) {
      transitionError.value = options.t('common.error_export') || `Export failed: ${String(error)}`
    }
    finally {
      isExporting.value = false
      exportProgress.value = 0
    }
  }

  async function handleTransition(issueKey: string, actionIntents: string) {
    updatingKeys.value.add(issueKey)
    transitionError.value = null

    try {
      const intents = actionIntents.split(',').map(s => s.trim()).filter(Boolean)
      let succeeded = false

      for (const intent of intents) {
        let transitionId: string | null = null

        // 判断是数字 ID（来自详情页 transition 按钮）还是意图字符串（来自卡片快捷按钮）
        if (/^\d+$/.test(intent)) {
          // 直接使用数字 ID
          transitionId = intent
        }
        else {
          // 动态获取当前可用的 transitions，按语义意图匹配
          const available = await jira.getTransitionsOnce(issueKey)
          const matched = findTransitionByIntent(available, intent)

          if (!matched) {
            console.warn(`No transition matched for intent "${intent}". Available:`, available.map(t => `${t.id}:${t.name}`))
            // 多步骤中非最后一步没匹配到，跳过（比如已经在进行中了，不需要 "start"）
            if (intents.length > 1 && intent !== intents[intents.length - 1])
              continue
            transitionError.value = options.t('common.error_no_transition') || `No matching transition found for: ${intent}`
            break
          }
          transitionId = matched.id
        }

        const { error, execute, data: transitionData } = jira.doTransition(issueKey, transitionId)
        await execute()

        if (error.value) {
          const detailError = transitionData.value?.errorMessages?.[0]
            || transitionData.value?.errors?.[Object.keys(transitionData.value?.errors || {})[0]]
            || error.value

          transitionError.value = `${options.t('common.error_fetch')}: ${detailError}`
          console.error('Transition failed:', error.value, transitionData.value)
          break
        }

        succeeded = true
      }

      if (succeeded && !transitionError.value) {
        // 进入测试状态后保留卡片，以便刷新并展示最新状态。
        if (intents.at(-1) !== 'test')
          dismissedKeys.value = new Set([...dismissedKeys.value, issueKey])

        // 关闭详情弹窗（已处理完毕）
        if (selectedIssueKey.value === issueKey)
          closeDetail()

        // 后台刷新数据
        void fetchBugs()
      }
    }
    catch (error) {
      transitionError.value = `An unexpected error occurred: ${String(error)}`
    }
    finally {
      updatingKeys.value.delete(issueKey)
    }
  }

  async function handleAssign(issueKey: string, username: string | null) {
    updatingKeys.value.add(issueKey)
    transitionError.value = null

    try {
      const { error, execute, data: assignData } = jira.assignIssue(issueKey, username)
      await execute()

      if (error.value) {
        const detailError = assignData.value?.errorMessages?.[0]
          || assignData.value?.errors?.[Object.keys(assignData.value?.errors || {})[0]]
          || error.value

        transitionError.value = `${options.t('common.error_fetch')}: ${detailError}`
        console.error('Assignment failed with status:', error.value)
        console.error('Assignment response data:', assignData.value)
      }
      else {
        await fetchBugs()
        if (selectedIssueKey.value === issueKey)
          await fetchDetail()
      }
    }
    catch (error) {
      transitionError.value = `An unexpected error occurred: ${String(error)}`
    }
    finally {
      updatingKeys.value.delete(issueKey)
    }
  }

  return {
    jira,
    projectFilter,
    unresolvedOnly,
    assigneeFilter,
    priorityFilter,
    selectedIssueKey,
    activeTab,
    myProjects,
    projectUsers,
    isUsersLoading,
    isInitialLoading,
    priorities,
    isPrioritiesLoading,
    allIssues,
    reopenedIssues,
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
    isExporting,
    exportProgress,
    exportAllIssues,
    exportSingleIssue,
    handleTransition,
    handleAssign,
    toggleTodo,
    todoKeys,
  }
}
