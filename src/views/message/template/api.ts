import { http } from '~/utils'

export interface TemplateListParams {
  templateName?: string
  templateCode?: string
  channelType?: string
  status?: string
  pageNum?: number
  pageSize?: number
}

export function getTemplateList(params: TemplateListParams) {
  return http.Get('/notice/template/list', { params }).send(true)
}

export function getTemplateDetail(id: string) {
  return http.Get(`/notice/template/${id}`).send(true)
}

export function createTemplate(data: Record<string, unknown>) {
  return http.Post('/notice/template', data).send(true)
}

export function updateTemplate(id: string, data: Record<string, unknown>) {
  return http.Put(`/notice/template/${id}`, data).send(true)
}

export function deleteTemplate(id: string) {
  return http.Delete(`/notice/template/${id}`).send(true)
}

export function batchDeleteTemplate(ids: string[]) {
  return http.Delete('/notice/template/batch/delete', { ids }).send(true)
}

export function renderPreview(data: { content: string; title?: string; params: Record<string, unknown> }) {
  return http.Post('/notice/template/render-preview', data).send(true)
}

export function testSendTemplate(data: { templateId: string; receiver: string; params: Record<string, unknown> }) {
  return http.Post('/notice/template/test-send', data).send(true)
}
