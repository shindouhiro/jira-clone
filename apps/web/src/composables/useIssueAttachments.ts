import type { JiraClient, JiraIssue } from '@jira/shared'
import type { Ref } from 'vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { isImageAttachment } from '@/utils/issue'

interface UseIssueAttachmentsOptions {
  jira: JiraClient
  issue: Ref<JiraIssue | null>
}

export function useIssueAttachments(options: UseIssueAttachmentsOptions) {
  const imageThumbnails = ref<Record<string, string>>({})
  const previewImageUrl = ref<string | null>(null)
  const isLoadingPreview = ref(false)
  const previewRequestId = ref(0)

  const images = computed(() => options.issue.value?.fields.attachment?.filter(isImageAttachment) || [])
  const otherFiles = computed(() => options.issue.value?.fields.attachment?.filter(file => !isImageAttachment(file)) || [])

  function releaseObjectUrl(url: string | null) {
    if (url && url !== 'loading')
      URL.revokeObjectURL(url)
  }

  function clearThumbnails() {
    Object.values(imageThumbnails.value).forEach(releaseObjectUrl)
    imageThumbnails.value = {}
  }

  function closePreview() {
    releaseObjectUrl(previewImageUrl.value)
    previewImageUrl.value = null
  }

  async function loadThumbnail(url: string) {
    if (imageThumbnails.value[url])
      return

    try {
      const proxiedUrl = options.jira.resolveUrl(url)
      const response = await fetch(proxiedUrl, { headers: options.jira.getAuthHeaders() })
      if (!response.ok)
        return

      const blobUrl = URL.createObjectURL(await response.blob())
      imageThumbnails.value = {
        ...imageThumbnails.value,
        [url]: blobUrl,
      }
    }
    catch (error) {
      console.error('Failed to load thumbnail:', error)
    }
  }

  async function openPreview(url: string) {
    previewRequestId.value += 1
    const currentRequestId = previewRequestId.value

    isLoadingPreview.value = true
    closePreview()
    previewImageUrl.value = 'loading'

    try {
      const proxiedUrl = options.jira.resolveUrl(url)
      const response = await fetch(proxiedUrl, { headers: options.jira.getAuthHeaders() })
      if (!response.ok) {
        previewImageUrl.value = null
        return
      }

      const blobUrl = URL.createObjectURL(await response.blob())
      if (currentRequestId !== previewRequestId.value) {
        releaseObjectUrl(blobUrl)
        return
      }

      previewImageUrl.value = blobUrl
    }
    finally {
      if (currentRequestId === previewRequestId.value)
        isLoadingPreview.value = false
    }
  }

  watch(
    () => options.issue.value?.key,
    async () => {
      closePreview()
      clearThumbnails()
      const currentImages = images.value
      await Promise.all(currentImages.map(image => loadThumbnail(image.thumbnail || image.content)))
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    closePreview()
    clearThumbnails()
  })

  return {
    images,
    otherFiles,
    imageThumbnails,
    previewImageUrl,
    isLoadingPreview,
    openPreview,
    closePreview,
  }
}
