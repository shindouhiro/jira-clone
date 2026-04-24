import { useFetch } from '@vueuse/core'
import { ref } from 'vue'

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
    assignee?: {
      displayName: string
    }
    project: {
      key: string
      name: string
    }
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
        author: {
          displayName: string
        }
        body: string
        created: string
      }>
    }
  }
}

export interface JiraSearchResponse {
  issues: JiraIssue[]
  total: number
}

export interface JiraTransition {
  id: string
  name: string
}

export class JiraClient {
  private auth: string

  constructor(username: string, password: string, private baseUrl: string = '/api-jira') {
    this.auth = btoa(`${username}:${password}`)
  }

  getAuthHeaders() {
    return {
      Authorization: `Basic ${this.auth}`,
    }
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
   * 获取 Bug 列表
   * 返回 VueUse 的 useFetch 对象
   */
  getBugs(project: () => string | undefined, unresolvedOnly: () => boolean, maxResults = 50) {
    const url = () => {
      let jql = 'issuetype = Bug AND assignee = currentUser()'
      const p = project()
      if (p)
        jql += ` AND project = "${p}"`
      if (unresolvedOnly())
        jql += ' AND resolution = Unresolved'

      jql += ' ORDER BY created DESC'

      const params = new URLSearchParams({
        jql,
        maxResults: maxResults.toString(),
      })

      return `${this.baseUrl}/rest/api/2/search?${params.toString()}`
    }

    return useFetch(url, {
      headers: {
        Authorization: `Basic ${this.auth}`,
        Accept: 'application/json',
      },
    }, {
      refetch: true, // 监听 URL 变化并自动重新拉取
      beforeFetch({ options }) {
        // 可以在这里添加通用的请求拦截逻辑
        return { options }
      },
    }).get().json<JiraSearchResponse>()
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
}

export interface JiraProject {
  id: string
  key: string
  name: string
  projectCategory?: {
    name: string
  }
}
