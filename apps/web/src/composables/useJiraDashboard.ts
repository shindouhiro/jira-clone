import { JiraClient } from '@jira/shared'
import { useLocalStorage } from '@vueuse/core'
import { computed, ref } from 'vue'

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

  const projectFilter = ref('')
  const unresolvedOnly = ref(true)
  const selectedIssueKey = ref<string | null>(null)
  const activeTab = ref<'all' | 'todo'>('all')

  const { data: allMyIssuesData, isFetching: isInitialLoading } = jira.getBugs(() => '', () => false, 200)

  const myProjects = computed<DashboardProject[]>(() => {
    const issues = allMyIssuesData.value?.issues || []
    const projectMap = new Map<string, DashboardProject>()

    issues.forEach((issue) => {
      const project = issue.fields.project
      if (!projectMap.has(project.key)) {
        projectMap.set(project.key, {
          key: project.key,
          name: project.name,
        })
      }
    })

    return Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  })

  const {
    data,
    error: fetchError,
    isFetching,
    execute: fetchBugs,
  } = jira.getBugs(
    () => projectFilter.value,
    () => unresolvedOnly.value,
  )

  const allIssues = computed(() => {
    const fetchedIssues = data.value?.issues || []
    return sortIssuesOpenFirst(fetchedIssues)
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

  const issues = computed(() => {
    return activeTab.value === 'todo' ? todoIssues.value : allIssues.value
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

  async function handleTransition(issueKey: string, transitionIds: string) {
    updatingKeys.value.add(issueKey)
    transitionError.value = null

    try {
      const ids = transitionIds.split(',').map(id => id.trim()).filter(Boolean)

      for (const id of ids) {
        const { error, execute, data: transitionData } = jira.doTransition(issueKey, id)
        await execute()

        if (error.value) {
          const detailError = transitionData.value?.errorMessages?.[0]
            || transitionData.value?.errors?.[Object.keys(transitionData.value?.errors || {})[0]]
            || error.value

          transitionError.value = `${options.t('common.error_fetch')}: ${detailError}`
          console.error('Transition failed with status:', error.value)
          console.error('Transition response data:', transitionData.value)
          break
        }
      }

      if (!transitionError.value) {
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
    selectedIssueKey,
    activeTab,
    myProjects,
    isInitialLoading,
    allIssues,
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
    handleAssign,
    toggleTodo,
    todoKeys,
  }
}
