export type FileCategory =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "word"
  | "excel"
  | "pptx"
  | "markdown"
  | "text"
  | "archive"
  | "other";

/** 取小写扩展名（含点），无扩展名返回空串 */
export function getExt(filename: string): string {
  if (!filename) return "";
  const idx = filename.lastIndexOf(".");
  if (idx < 0 || idx === filename.length - 1) return "";
  return filename.slice(idx).toLowerCase();
}

/** 后缀 → 分类映射表 */
const EXT_MAP: Record<string, FileCategory> = {
  // 图片
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".gif": "image",
  ".webp": "image",
  ".bmp": "image",
  ".svg": "image",
  ".ico": "image",
  ".tif": "image",
  ".tiff": "image",
  ".heic": "image",

  // 视频
  ".mp4": "video",
  ".mov": "video",
  ".avi": "video",
  ".mkv": "video",
  ".webm": "video",
  ".flv": "video",
  ".m3u8": "video",
  ".ts": "video",
  ".wmv": "video",
  ".m4v": "video",
  ".3gp": "video",

  // 音频
  ".mp3": "audio",
  ".wav": "audio",
  ".flac": "audio",
  ".aac": "audio",
  ".ogg": "audio",
  ".m4a": "audio",
  ".wma": "audio",
  ".ape": "audio",

  // 文档
  ".pdf": "pdf",
  ".doc": "word",
  ".docx": "word",
  ".xls": "excel",
  ".xlsx": "excel",
  ".csv": "excel",
  ".ppt": "pptx",
  ".pptx": "pptx",

  // 文本
  ".md": "markdown",
  ".markdown": "markdown",
  ".mdown": "markdown",
  ".mkd": "markdown",
  ".txt": "text",
  ".log": "text",
  ".json": "text",
  ".xml": "text",
  ".yaml": "text",
  ".yml": "text",
  ".html": "text",
  ".htm": "text",
  ".css": "text",
  ".js": "text",
  ".vue": "text",

  // 压缩包
  ".zip": "archive",
  ".rar": "archive",
  ".7z": "archive",
  ".tar": "archive",
  ".gz": "archive",
  ".tgz": "archive",
  ".bz2": "archive",
  ".xz": "archive",
};

export function getFileCategory(filename: string): FileCategory {
  const ext = getExt(filename);
  return EXT_MAP[ext] ?? "other";
}
