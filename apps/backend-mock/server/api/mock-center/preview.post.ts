import { defineEventHandler, readBody } from '#imports'
import { bizError, envelope } from '../../utils/response'
import { renderPreview } from '../../utils/templates'

/** 渲染一次 mockjs 模板供面板预览；失败只回业务码 400，与 legacy 一致 */
export default defineEventHandler(async (event) => {
  const body = ((await readBody(event)) ?? {}) as Record<string, unknown>
  const preview = renderPreview(body.template)

  if ('error' in preview) return bizError(400, preview.error)
  return envelope(200, { sample: preview.sample }, '模板预览成功')
})
