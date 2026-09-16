import { http } from "@/utils";
import { del, get } from "./request";
import type { FetchParams } from "@/components/business/Table";

// ============================================================
// 文件管理
// ============================================================

export function getFileList(params?: FetchParams) {
  return get<{ list: any[]; total: number }>("/file/list", params as any);
}

export function deleteFile(id: string) {
  return del<void>(`/file/${id}`);
}

// ============================================================
// 文件上传
// ============================================================

export function uploadFile(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return http.Post<any>("/upload/file", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function checkUploadedChunks(uploadId: string) {
  return http.Get("/upload/check", { params: { uploadId } });
}

export function uploadChunk(data: FormData) {
  return http.Post("/upload/chunk", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function mergeChunks(data: Record<string, unknown>) {
  return http.Post("/upload/merge", data);
}

export function deleteUploadedFile(url: string) {
  return http.Post("/upload/delete", { url });
}
