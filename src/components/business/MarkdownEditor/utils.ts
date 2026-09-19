import { message } from "antdv-next";

import { http } from "~/utils";

/* ============================================================
 * 上传接口
 * ============================================================ */

export interface UploadResult {
  fileId: string;
  filename: string;
  url: string;
  size: number;
  mimeType?: string;
}

interface ApiResponse<T> {
  code: number;
  message?: string;
  data?: T;
}

/* ============================================================
 * 校验
 * ============================================================ */

export interface ValidateOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
  /** 用于错误提示，例如"图片" / "视频" */
  label?: string;
}

/** 校验文件，通过返回 true，失败返回 false 并 message 提示 */
export function validateFile(file: File, options: ValidateOptions): boolean {
  const { maxSizeMB, allowedTypes, label = "文件" } = options;

  if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
    message.error(`${label}大小不能超过 ${maxSizeMB}MB`);
    return false;
  }

  if (allowedTypes && allowedTypes.length > 0) {
    const type = file.type || "";
    const matched = allowedTypes.some((t) => {
      // 支持 "image/*" 通配
      if (t.endsWith("/*")) return type.startsWith(t.slice(0, -1));
      return type === t;
    });
    if (!matched) {
      message.error(`${label}格式不支持`);
      return false;
    }
  }

  return true;
}

/* ============================================================
 * 上传
 * ============================================================ */

export interface UploadFileOptions {
  file: File;
  /** 上传接口，默认 /api/v1/upload/file */
  server?: string;
  /** 字段名，默认 file */
  fieldName?: string;
  /** 附加字段 */
  meta?: Record<string, unknown>;
  /** 进度回调 */
  onProgress?: (percent: number) => void;
}

/**
 * 上传文件（走系统 http 封装，自动带 token / 租户头）
 */
export async function uploadFile(options: UploadFileOptions): Promise<UploadResult> {
  const { file, server = "/upload/file", fieldName = "file", meta } = options;

  const formData = new FormData();
  formData.append(fieldName, file);

  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      if (v !== undefined && v !== null) formData.append(k, String(v));
    }
  }

  const res = (await http.Post(server, formData)) as ApiResponse<UploadResult> | UploadResult;

  const payload = (res as ApiResponse<UploadResult>)?.data ?? (res as UploadResult);

  if (!payload?.url) {
    throw new Error("上传响应缺少 url");
  }

  return payload;
}
