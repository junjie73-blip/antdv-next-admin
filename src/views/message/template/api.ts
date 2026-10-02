import { del, get, post, put } from '~/api/request'

import type { TemplateListParams } from './types'

/* ============================================================
 * 列表 / 详情
 * ============================================================ */
export function getTemplateList(params: TemplateListParams) {
  return get<{ list: any[]; total: number }>('/notice/template/list', params as any)
}

export function getTemplateDetail(id: string) {
  return get<any>(`/notice/template/${id}`)
}

/** 模板下拉选项（用于通知公告发布时选择） */
export function getTemplateOptions(channelType?: string) {
  return get<{ label: string; value: string; channelType: string; status: string }[]>('/notice/template/options', {
    channelType,
  } as any)
}

/* ============================================================
 * CRUD
 * ============================================================ */
export function createTemplate(data: Record<string, unknown>) {
  return post<void>('/notice/template', data)
}

export function updateTemplate(id: string, data: Record<string, unknown>) {
  return put<void>(`/notice/template/${id}`, data)
}

export function deleteTemplate(id: string) {
  return del<void>(`/notice/template/${id}`)
}

/** 批量删除（POST，避免 DELETE + body 的兼容性问题） */
export function batchDeleteTemplate(ids: string[]) {
  return post<void>('/notice/template/batch/delete', { ids })
}

/* ============================================================
 * 渲染 / 测试
 * ============================================================ */
export function renderPreview(data: { content: string; title?: string; params: Record<string, unknown> }) {
  return post<{ title: string; content: string }>('/notice/template/render-preview', data)
}

export function testSendTemplate(data: { templateId: string; receiver: string; params: Record<string, unknown> }) {
  return post<void>('/notice/template/test-send', data)
}
