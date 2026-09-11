/** 文件记录（对齐后端 sys_file 表） */
export interface FileRecord {
  fileId: string;
  tenantId?: string;
  filename: string;
  url: string;
  size: number;
  mimeType?: string;
  uploader?: string;
  createdAt: string;
}

/** MIME 类型筛选选项 */
export interface MimeTypeOption {
  label: string;
  value: string;
}
