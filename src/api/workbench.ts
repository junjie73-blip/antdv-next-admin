import { request } from '~/composables'

// ============================================================
// 工作台
// ============================================================

export const getWorkbenchSummary = (): any => request.get('/workbench/summary')
