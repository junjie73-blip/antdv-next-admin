import { request } from '~/composables'
// ============================================================
// 定时任务
// ============================================================

export function getJobList(params: any) {
  return request.get('/job/list', params)
}

export function createJob(data: any) {
  return request.post('/job', data)
}

export function updateJob(id: string, data: any) {
  return request.put(`/job/${id}`, data)
}

export function deleteJob(id: string) {
  return request.delete(`/job/${id}`)
}

/** 启停任务 —— body 是 { status: "0"|"1" } */
export function toggleJobStatus(id: string, status: string) {
  return request.put(`/job/${id}/status`, { status })
}

export function runJobOnce(id: string) {
  return request.post(`/job/${id}/run`)
}

export function pauseJob(id: string) {
  return request.put(`/job/${id}/pause`)
}

export function resumeJob(id: string) {
  return request.put(`/job/${id}/resume`)
}

// ============================================================
// 任务日志
// ============================================================

export function getJobLogList(params: any) {
  return request.get('/job-log/list', params)
}

export function clearJobLog(jobId?: string) {
  return request.delete('/job-log/clear', { jobId })
}
