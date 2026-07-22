import { useFetch } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'

export interface JiraIssue {
  key: string
  fields: {
    summary: string
    status: {
      name: string
    }
    priority: {
      name: string
    }
    assignee?: JiraUser
    project: {
      key: string
      name: string
    }
    issuetype?: {
      name: string
    }
    resolution?: {
      name: string
    } | null
    description: string
    created: string
    updated: string
    attachment?: Array<{
      id: string
      filename: string
      mimeType: string
      thumbnail?: string
      content: string
      size: number
    }>
    comment?: {
      comments: Array<{
        author: JiraUser
        body: string
        created: string
      }>
    }
  }
}

export interface JiraUser {
  name: string
  key: string
  displayName: string
  avatarUrls: Record<string, string>
}

export interface JiraSearchResponse {
  issues: JiraIssue[]
  total: number
  startAt?: number
  maxResults?: number
}

export interface JiraTransition {
  id: string
  name: string
}

export class JiraClient {
  private auth: string

  constructor(username: string, password: string, private baseUrl: string = (import.meta as any).env?.VITE_JIRA_BASE_URL || '/api-jira') {
    this.auth = btoa(`${username}:${password}`)
  }

  private buildAssignedIssuesJql(project?: string, unresolvedOnly = false, assignees: string[] = ['currentUser()']) {
    const escapedProject = project?.replace(/([\\"])/g, '\\$1')
    let jql = escapedProject
      ? `project = "${escapedProject}"`
      : 'issuetype = Bug'

    if (assignees.length > 0 && !assignees.includes('all')) {
      const formattedAssignees = assignees.map(a => a === 'currentUser()' ? 'currentUser()' : `"${a.replace(/([\\"])/g, '\\$1')}"`)
      jql += ` AND assignee IN (${formattedAssignees.join(', ')})`
    }

    if (unresolvedOnly)
      jql += ' AND resolution = Unresolved'

    return `${jql} ORDER BY created DESC`
  }

  private async fetchAllIssues(jql: string, signal?: AbortSignal, fields?: string[]): Promise<JiraSearchResponse> {
    const issues: JiraIssue[] = []
    const pageSize = 100
    let startAt = 0
    let total = 0

    do {
      const params = new URLSearchParams({
        jql,
        startAt: startAt.toString(),
        maxResults: pageSize.toString(),
      })
      if (fields?.length)
        params.set('fields', fields.join(','))

      const response = await fetch(`${this.baseUrl}/rest/api/2/search?${params.toString()}`, {
        headers: {
          Authorization: `Basic ${this.auth}`,
          Accept: 'application/json',
        },
        signal,
      })

      if (!response.ok)
        throw new Error(`HTTP ${response.status} ${response.statusText}`)

      const page = await response.json() as JiraSearchResponse
      issues.push(...page.issues)
      total = page.total
      startAt += page.issues.length

      if (page.issues.length === 0)
        break
    } while (startAt < total)

    return {
      issues,
      total,
      startAt: 0,
      maxResults: issues.length,
    }
  }

  getAuthHeaders() {
    return {
      Authorization: `Basic ${this.auth}`,
    }
  }

  async getAttachmentBlob(url: string) {
    const response = await fetch(this.resolveUrl(url), {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok)
      throw new Error(`HTTP ${response.status} ${response.statusText}`)

    return response.blob()
  }

  /**
   * 将 Jira 绝对路径转换为代理路径
   */
  resolveUrl(url: string) {
    if (!url)
      return url
    // 如果 URL 是以 http 开头的绝对路径，尝试将其转换为相对代理路径
    // 假设原始主机名是 jira.cloudtogo.local (根据用户反馈)
    // 或者更通用的做法：如果包含 /rest/ 或 /secure/，且不是以 baseUrl 开头，则替换
    if (url.startsWith('http') && !url.startsWith(this.baseUrl)) {
      try {
        const u = new URL(url)
        return `${this.baseUrl}${u.pathname}${u.search}`
      }
      catch {
        return url
      }
    }
    return url
  }

  /**
   * 获取看板问题列表。
   * 未选择项目时显示分配给当前用户的 Bug；选择项目后显示该项目中分配给当前用户的全部问题。
   * Jira 搜索接口可能限制单页大小，因此自动请求后续分页。
   */
  getBugs(project: () => string | undefined, unresolvedOnly: () => boolean, assignees: () => string[] = () => ['currentUser()']) {
    const data = shallowRef<JiraSearchResponse>()
    const error = shallowRef<unknown>(null)
    const isFetching = shallowRef(false)
    let activeController: AbortController | undefined
    let requestSequence = 0

    const execute = async () => {
      activeController?.abort()
      const controller = new AbortController()
      activeController = controller
      const currentSequence = ++requestSequence
      const jql = this.buildAssignedIssuesJql(project(), unresolvedOnly(), assignees())

      error.value = null
      isFetching.value = true

      try {
        const response = await this.fetchAllIssues(jql, controller.signal)

        if (currentSequence === requestSequence)
          data.value = response
      }
      catch (fetchError) {
        if (currentSequence === requestSequence)
          error.value = fetchError
      }
      finally {
        if (currentSequence === requestSequence) {
          isFetching.value = false
          activeController = undefined
        }
      }
    }

    watch(
      [project, unresolvedOnly],
      (_values, _oldValues, onCleanup) => {
        void execute()
        onCleanup(() => {
          requestSequence++
          activeController?.abort()
          activeController = undefined
        })
      },
      { immediate: true },
    )

    return { data, error, isFetching, execute }
  }

  /**
   * 获取当前用户在指定项目中的全部问题，不受看板状态筛选影响。
   */
  getAllAssignedIssues(project?: string) {
    return this.fetchAllIssues(
      this.buildAssignedIssuesJql(project),
      undefined,
      [
        'summary',
        'status',
        'priority',
        'assignee',
        'project',
        'issuetype',
        'resolution',
        'description',
        'created',
        'updated',
        'attachment',
      ],
    )
  }

  /**
   * 获取 Issue 详情
   */
  getIssueDetail(issueKey: () => string | null) {
    const url = () => {
      const key = issueKey()
      return `${this.baseUrl}/rest/api/2/issue/${key || ''}`
    }

    return useFetch(url, {
      headers: {
        Authorization: `Basic ${this.auth}`,
        Accept: 'application/json',
      },
    }, {
      refetch: true,
      immediate: false, // 只有在有 issueKey 时才执行
      beforeFetch({ cancel, options }) {
        if (!issueKey())
          cancel()
        return { options }
      },
    }).get().json<JiraIssue>()
  }

  /**
   * 获取 Issue 的可执行转换列表
   */
  getTransitions(issueKey: () => string | null) {
    const url = () => {
      const key = issueKey()
      return `${this.baseUrl}/rest/api/2/issue/${key || ''}/transitions`
    }

    return useFetch(url, {
      headers: {
        Authorization: `Basic ${this.auth}`,
        Accept: 'application/json',
      },
    }, {
      refetch: true,
      immediate: false,
      beforeFetch({ cancel, options }) {
        if (!issueKey())
          cancel()
        return { options }
      },
    }).get().json<{ transitions: JiraTransition[] }>()
  }

  /**
   * 一次性获取 Issue 的可用转换列表（命令式，非响应式）
   * 用于快速操作前动态查找正确的 transition ID
   */
  async getTransitionsOnce(issueKey: string): Promise<JiraTransition[]> {
    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}/transitions`
    const res = await fetch(url, {
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Accept': 'application/json',
      },
    })
    if (!res.ok)
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    const data = await res.json()
    return data.transitions || []
  }

  /**
   * 执行 Issue 状态转换
   */
  doTransition(issueKey: string, transitionId: string) {
    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}/transitions`
    const error = ref<any>(null)
    const data = ref<any>(null)

    const execute = async () => {
      error.value = null
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Atlassian-Token': 'no-check',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            transition: { id: String(transitionId) },
          }),
        })

        if (!res.ok) {
          const text = await res.text()
          try {
            data.value = JSON.parse(text)
          }
          catch {
            data.value = text
          }
          error.value = `HTTP ${res.status} ${res.statusText}`
          return
        }

        if (res.status !== 204) {
          data.value = await res.json()
        }
      }
      catch (err: any) {
        error.value = err.message || 'Network error'
      }
    }

    return { error, execute, data }
  }

  /**
   * 分配 Issue 给指定用户
   */
  assignIssue(issueKey: string, username: string | null) {
    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}/assignee`
    const error = ref<any>(null)
    const data = ref<any>(null)

    const execute = async () => {
      error.value = null
      try {
        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Atlassian-Token': 'no-check',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            name: username,
          }),
        })

        if (!res.ok) {
          const text = await res.text()
          try {
            data.value = JSON.parse(text)
          }
          catch {
            data.value = text
          }
          error.value = `HTTP ${res.status} ${res.statusText}`
          return
        }

        // 成功时返回 204 No Content
        if (res.status !== 204) {
          data.value = await res.json()
        }
      }
      catch (err: any) {
        error.value = err.message || 'Network error'
      }
    }

    return { error, execute, data }
  }

  /**
   * 查找可分配的用户
   */
  findAssignableUsers(issueKey: string, query = '') {
    const params = new URLSearchParams({
      issueKey,
      username: query,
    })
    const url = `${this.baseUrl}/rest/api/2/user/assignable/search?${params.toString()}`

    return useFetch(url, {
      headers: {
        Authorization: `Basic ${this.auth}`,
        Accept: 'application/json',
      },
    }).get().json<JiraUser[]>()
  }

  /**
   * 获取所有项目
   */
  getProjects() {
    const url = `${this.baseUrl}/rest/api/2/project`
    return useFetch(url, {
      headers: {
        Authorization: `Basic ${this.auth}`,
        Accept: 'application/json',
      },
    }).get().json<JiraProject[]>()
  }

  /**
   * 查找项目下的可分配用户
   */
  getProjectUsers(projectKey: () => string) {
    const url = computed(() => {
      const pk = projectKey()
      if (!pk) return ''
      const params = new URLSearchParams({ project: pk })
      return `${this.baseUrl}/rest/api/2/user/assignable/search?${params.toString()}`
    })

    return useFetch(url, {
      headers: {
        Authorization: `Basic ${this.auth}`,
        Accept: 'application/json',
      },
    }, {
      refetch: true,
    }).get().json<JiraUser[]>()
  }
}

export interface JiraProject {
  id: string
  key: string
  name: string
  projectCategory?: {
    name: string
  }
}
