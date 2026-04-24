import { useFetch } from '@vueuse/core'

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
    created: string
  }
}

export interface JiraSearchResponse {
  issues: JiraIssue[]
  total: number
}

export class JiraClient {
  private auth: string

  constructor(username: string, password: string, private baseUrl: string = '/api-jira') {
    this.auth = btoa(`${username}:${password}`)
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
      beforeFetch({ options }) {
        // 可以在这里添加通用的请求拦截逻辑
        return { options }
      },
    }).get().json<JiraSearchResponse>()
  }

  /**
   * 获取 Issue 的可执行转换列表
   */
  getTransitions(issueKey: string) {
    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}/transitions`
    return useFetch(url, {
      headers: {
        Authorization: `Basic ${this.auth}`,
        Accept: 'application/json',
      },
    }).get().json<{ transitions: any[] }>()
  }

  /**
   * 执行 Issue 状态转换
   */
  doTransition(issueKey: string, transitionId: string) {
    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}/transitions`
    return useFetch(url, {
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/json',
      },
    }).post({
      transition: { id: transitionId },
    }).json()
  }
}
