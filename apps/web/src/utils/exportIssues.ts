import type { JiraIssue } from '@jira/shared'
import type { Cell, Row, Workbook, Worksheet } from 'exceljs'
import { isImageAttachment } from '@/utils/issue'

type JiraAttachment = NonNullable<JiraIssue['fields']['attachment']>[number]
type ExcelImageExtension = 'png' | 'jpeg' | 'gif'

interface CreateIssuesWorkbookOptions {
  projectKey?: string
  formatAssignee?: (displayName: string) => string
  loadImage?: (url: string) => Promise<Blob>
  onImageProgress?: (completed: number, total: number) => void
}

interface LoadedImage {
  attachment: JiraAttachment
  base64: string
  extension: ExcelImageExtension
  width: number
  height: number
}

const COLORS = {
  teal: 'FF0F766E',
  tealLight: 'FFCCFBF1',
  slate: 'FF334155',
  slateLight: 'FFF1F5F9',
  border: 'FFE2E8F0',
  white: 'FFFFFFFF',
  link: 'FF0284C7',
}

function safeText(value: unknown) {
  let text = value == null ? '' : String(value)
  if (/^[\t\r\n ]*[=+\-@]/.test(text))
    text = `'${text}`
  return text.slice(0, 32_000)
}

function toDate(value?: string) {
  if (!value)
    return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getExcelImageExtension(blob: Blob): ExcelImageExtension | null {
  if (blob.type === 'image/png')
    return 'png'
  if (blob.type === 'image/jpeg' || blob.type === 'image/jpg')
    return 'jpeg'
  if (blob.type === 'image/gif')
    return 'gif'
  return null
}

async function blobToDataUrl(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const chunkSize = 0x8000
  let binary = ''

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }

  return `data:${blob.type};base64,${btoa(binary)}`
}

async function getImageDimensions(blob: Blob) {
  if (typeof createImageBitmap !== 'function')
    return { width: 160, height: 100 }

  const bitmap = await createImageBitmap(blob)
  const dimensions = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return dimensions
}

function fitImage(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / width, maxHeight / height, 1)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function loadImages(
  attachments: JiraAttachment[],
  options: CreateIssuesWorkbookOptions,
) {
  const loadedImages = new Map<string, LoadedImage>()
  const imageAttachments = attachments.filter(isImageAttachment)
  const loadImage = options.loadImage
  options.onImageProgress?.(0, imageAttachments.length)

  if (!loadImage || imageAttachments.length === 0)
    return loadedImages

  let cursor = 0
  let completed = 0
  const concurrency = Math.min(4, imageAttachments.length)

  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < imageAttachments.length) {
      const attachment = imageAttachments[cursor++]

      try {
        const blob = await loadImage(attachment.thumbnail || attachment.content)
        const extension = getExcelImageExtension(blob)
        if (!extension)
          continue

        const dimensions = await getImageDimensions(blob)
        loadedImages.set(attachment.id, {
          attachment,
          base64: await blobToDataUrl(blob),
          extension,
          ...dimensions,
        })
      }
      catch (error) {
        console.warn(`Failed to load export image: ${attachment.filename}`, error)
      }
      finally {
        completed += 1
        options.onImageProgress?.(completed, imageAttachments.length)
      }
    }
  }))

  return loadedImages
}

function styleHeader(worksheet: Worksheet) {
  const header = worksheet.getRow(1)
  header.height = 28
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLORS.white } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.teal } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
}

function styleDataRow(row: Row) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.alignment = { vertical: 'top', wrapText: true }
    cell.border = {
      bottom: { style: 'thin', color: { argb: COLORS.border } },
    }
  })

  if (row.number % 2 === 0) {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.slateLight } }
    })
  }
}

function styleHyperlink(cell: Cell) {
  cell.font = { color: { argb: COLORS.link }, underline: true }
}

function addEmbeddedImage(
  workbook: Workbook,
  worksheet: Worksheet,
  image: LoadedImage,
  rowNumber: number,
  columnIndex: number,
  maxWidth: number,
  maxHeight: number,
) {
  const imageId = workbook.addImage({
    base64: image.base64,
    extension: image.extension,
  })
  const size = fitImage(image.width, image.height, maxWidth, maxHeight)

  worksheet.addImage(imageId, {
    tl: { col: columnIndex + 0.1, row: rowNumber - 0.9 },
    ext: size,
    editAs: 'oneCell',
    hyperlinks: {
      hyperlink: image.attachment.content,
      tooltip: `打开原图：${image.attachment.filename}`,
    },
  })
}

function configureIssuesSheet(
  workbook: Workbook,
  issues: JiraIssue[],
  loadedImages: Map<string, LoadedImage>,
  formatAssignee: (displayName: string) => string,
) {
  const worksheet = workbook.addWorksheet('问题列表', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  })

  worksheet.columns = [
    { header: '问题编号', key: 'key', width: 16 },
    { header: '项目', key: 'project', width: 16 },
    { header: '类型', key: 'type', width: 12 },
    { header: '标题', key: 'summary', width: 48 },
    { header: '状态', key: 'status', width: 14 },
    { header: '解决结果', key: 'resolution', width: 14 },
    { header: '优先级', key: 'priority', width: 12 },
    { header: '经办人', key: 'assignee', width: 16 },
    { header: '创建时间', key: 'created', width: 20 },
    { header: '更新时间', key: 'updated', width: 20 },
    { header: '描述', key: 'description', width: 55 },
    { header: '附件数', key: 'attachmentCount', width: 10 },
    { header: '图片预览', key: 'preview', width: 26 },
  ]
  worksheet.autoFilter = 'A1:M1'
  styleHeader(worksheet)

  for (const issue of issues) {
    const attachments = issue.fields.attachment || []
    const firstImage = attachments
      .map(attachment => loadedImages.get(attachment.id))
      .find((image): image is LoadedImage => Boolean(image))
    const row = worksheet.addRow({
      key: safeText(issue.key),
      project: safeText(issue.fields.project.name),
      type: safeText(issue.fields.issuetype?.name),
      summary: safeText(issue.fields.summary),
      status: safeText(issue.fields.status.name),
      resolution: safeText(issue.fields.resolution?.name),
      priority: safeText(issue.fields.priority?.name),
      assignee: issue.fields.assignee?.displayName
        ? safeText(formatAssignee(issue.fields.assignee.displayName))
        : '',
      created: toDate(issue.fields.created),
      updated: toDate(issue.fields.updated),
      description: safeText(issue.fields.description),
      attachmentCount: attachments.length,
      preview: firstImage ? '' : '无图片',
    })

    row.height = firstImage ? 72 : 30
    styleDataRow(row)
    row.getCell('I').numFmt = 'yyyy-mm-dd hh:mm'
    row.getCell('J').numFmt = 'yyyy-mm-dd hh:mm'
    row.getCell('L').alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell('M').alignment = { vertical: 'middle', horizontal: 'center' }

    if (firstImage)
      addEmbeddedImage(workbook, worksheet, firstImage, row.number, 12, 150, 84)
  }

  return worksheet
}

function configureAttachmentsSheet(
  workbook: Workbook,
  issues: JiraIssue[],
  loadedImages: Map<string, LoadedImage>,
) {
  const worksheet = workbook.addWorksheet('附件明细', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  })

  worksheet.columns = [
    { header: '问题编号', key: 'issueKey', width: 16 },
    { header: '文件名', key: 'filename', width: 42 },
    { header: '类型', key: 'mimeType', width: 20 },
    { header: '大小 (KiB)', key: 'size', width: 14 },
    { header: '原图链接', key: 'link', width: 18 },
    { header: '图片预览', key: 'preview', width: 30 },
  ]
  worksheet.autoFilter = 'A1:F1'
  styleHeader(worksheet)

  for (const issue of issues) {
    for (const attachment of issue.fields.attachment || []) {
      const image = loadedImages.get(attachment.id)
      const row = worksheet.addRow({
        issueKey: safeText(issue.key),
        filename: safeText(attachment.filename),
        mimeType: safeText(attachment.mimeType),
        size: Math.round(attachment.size / 1024),
        link: { text: '打开原图', hyperlink: attachment.content },
        preview: image ? '' : '预览不可用',
      })

      row.height = image ? 78 : 30
      styleDataRow(row)
      row.getCell('D').numFmt = '#,##0'
      styleHyperlink(row.getCell('E'))
      row.getCell('F').alignment = { vertical: 'middle', horizontal: 'center' }

      if (image)
        addEmbeddedImage(workbook, worksheet, image, row.number, 5, 175, 90)
    }
  }

  return worksheet
}

export async function createIssuesWorkbook(
  issues: JiraIssue[],
  options: CreateIssuesWorkbookOptions = {},
) {
  const excelJsModule = await import('exceljs') as typeof import('exceljs') & {
    default?: typeof import('exceljs')
  }
  const ExcelWorkbook = excelJsModule.Workbook || excelJsModule.default?.Workbook
  if (!ExcelWorkbook)
    throw new Error('ExcelJS Workbook constructor is unavailable')

  const workbook = new ExcelWorkbook()
  const formatAssignee = options.formatAssignee || (displayName => displayName)
  const attachments = issues.flatMap(issue => issue.fields.attachment || [])
  const loadedImages = await loadImages(attachments, options)

  workbook.creator = 'Jira Dashboard'
  workbook.subject = `${options.projectKey || 'Jira'} 问题与附件导出`
  workbook.created = new Date()
  workbook.modified = new Date()

  configureIssuesSheet(workbook, issues, loadedImages, formatAssignee)
  configureAttachmentsSheet(workbook, issues, loadedImages)

  return workbook
}

export async function downloadIssuesXlsx(
  issues: JiraIssue[],
  options: CreateIssuesWorkbookOptions = {},
) {
  const workbook = await createIssuesWorkbook(issues, options)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob(
    [new Uint8Array(buffer)],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  )
  const downloadUrl = URL.createObjectURL(blob)
  const downloadLink = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  const projectKey = (options.projectKey || 'my-issues').replace(/[^a-z0-9_-]/gi, '-')

  downloadLink.id = 'jira-issues-export-download'
  downloadLink.href = downloadUrl
  downloadLink.download = `jira-${projectKey}-all-issues-${date}.xlsx`
  document.body.append(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)
}
