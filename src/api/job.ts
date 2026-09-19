import { http } from "~/utils";
// ============================================================
// 定时任务
// ============================================================

export function getJobList(params: any) {
  return http.Get("/job/list", { params });
}

export function createJob(data: any) {
  return http.Post("/job", data);
}

export function updateJob(id: string, data: any) {
  return http.Put(`/job/${id}`, data);
}

export function deleteJob(id: string) {
  return http.Delete(`/job/${id}`);
}

/** 启停任务 —— body 是 { status: "0"|"1" } */
export function toggleJobStatus(id: string, status: string) {
  return http.Put(`/job/${id}/status`, { status });
}

export function runJobOnce(id: string) {
  return http.Post(`/job/${id}/run`);
}

export function pauseJob(id: string) {
  return http.Put(`/job/${id}/pause`);
}

export function resumeJob(id: string) {
  return http.Put(`/job/${id}/resume`);
}

// ============================================================
// 任务日志
// ============================================================

export function getJobLogList(params: any) {
  return http.Get("/job-log/list", { params });
}

export function clearJobLog(jobId?: string) {
  return http.Delete("/job-log/clear", { params: { jobId } });
}
