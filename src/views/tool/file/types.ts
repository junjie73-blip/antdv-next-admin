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
  category?: string;
}

/** MIME 类型筛选选项 */
export interface MimeTypeOption {
  label: string;
  value: string;
}

/** 文件分类（左侧导航项） */
export interface FileCategory {
  /** 分类键，传给后端做过滤 */
  key: string;
  /** 显示名称 */
  label: string;
  /** iconify 图标名 */
  icon: string;
  /** 图标主色（激活态使用），可选 */
  color?: string;
  /** 匹配的 mimeType 前缀，空数组表示"全部" */
  mimePrefixes: string[];
  /** 该分类下文件数量，可选 */
  count?: number;
}
