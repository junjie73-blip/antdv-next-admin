// api/monitor-queue.ts
import { request } from '~/composables'

/* ============================================================
 * 类型
 * ============================================================ */
export interface QueueCounts {
  wait: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: number
}

export interface QueueOverview {
  name: string
  displayName?: string
  counts: QueueCounts
  isPaused: boolean
  workers: number
}

export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused' | 'stuck'

export interface JobRecord {
  id: string
  name: string
  status: JobStatus
  progress: number | object
  attemptsMade: number
  maxAttempts: number
  data: unknown
  returnvalue: unknown
  failedReason: string | null
  stacktrace: string[]
  timestamp: number
  processedOn: number | null
  finishedOn: number | null
  duration: number | null
  delayedUntil?: number | null
}

export interface QueueJobListParams {
  status?: JobStatus
  pageNum?: number
  pageSize?: number
  keyword?: string
}

export function getQueueOverview() {
  return request.get<QueueOverview[]>('/monitor/queue/overview')
}

export function getQueueJobs(queueName: string, params: QueueJobListParams) {
  return request.get<{ list: JobRecord[]; total: number }>(`/monitor/queue/${queueName}/jobs`, params)
}

export function getQueueJobDetail(queueName: string, jobId: string) {
  return request.get<JobRecord>(`/monitor/queue/${queueName}/job/${jobId}`)
}

export function retryQueueJob(queueName: string, jobId: string) {
  return request.post(`/monitor/queue/${queueName}/job/${jobId}/retry`)
}

export function removeQueueJob(queueName: string, jobId: string) {
  return request.post(`/monitor/queue/${queueName}/job/${jobId}/remove`)
}

export function pauseQueue(queueName: string) {
  return request.post(`/monitor/queue/${queueName}/pause`)
}

export function resumeQueue(queueName: string) {
  return request.post(`/monitor/queue/${queueName}/resume`)
}

export function cleanQueue(
  queueName: string,
  data: { status: 'completed' | 'failed' | 'delayed' | 'wait'; limit?: number },
) {
  return request.post<{ removed: number }>(`/monitor/queue/${queueName}/clean`, data)
}
