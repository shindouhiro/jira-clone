import { createFetch } from '@vueuse/core'

const useFetch = createFetch({
  baseUrl: 'http://jira.cloudtogo.local',
  options: {
    beforeFetch({ options }) {
      console.log('Headers:', options.headers)
      console.log('Body:', options.body)
      return { options }
    },
  },
})

useFetch('/rest/api/2/issue/CLOUDOS-5428/transitions', {
  immediate: false,
  headers: {
    'Authorization': `Basic d3V3ZWlkb25nOld1ODM2MDkwNDVA`,
    'X-Atlassian-Token': 'no-check',
    'X-Requested-With': 'XMLHttpRequest',
  },
}).post({ transition: { id: '11' } }).execute()
