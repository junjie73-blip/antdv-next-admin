/**
 * 文件管理内存库（legacy mock/file.fake.ts 的数据层）
 */

import { faker } from '@faker-js/faker/locale/zh_CN'
import dayjs from 'dayjs'

faker.seed(500)

export type FileType = 'folder' | 'image' | 'document' | 'video' | 'audio' | 'archive' | 'other'

export interface FileRecord {
  createdAt: string
  extension: string
  id: number
  isFolder: boolean
  mimeType: string
  name: string
  parentId: null | number
  path: string
  size: number
  sizeDisplay: string
  type: FileType
  updatedAt: string
  uploader: string
  uploaderId: number
}

export const UPLOADERS = [
  { id: 1, name: '超级管理员' },
  { id: 2, name: '张三' },
  { id: 3, name: '李四' },
  { id: 6, name: '孙七' },
  { id: 9, name: '郑十' },
  { id: 12, name: '黄三' },
]
const EXTENSION_MAP: Record<string, { type: FileType, mimeType: string }> = {
  jpg: { type: 'image', mimeType: 'image/jpeg' },
  jpeg: { type: 'image', mimeType: 'image/jpeg' },
  png: { type: 'image', mimeType: 'image/png' },
  gif: { type: 'image', mimeType: 'image/gif' },
  svg: { type: 'image', mimeType: 'image/svg+xml' },
  webp: { type: 'image', mimeType: 'image/webp' },
  doc: { type: 'document', mimeType: 'application/msword' },
  docx: { type: 'document', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  pdf: { type: 'document', mimeType: 'application/pdf' },
  xls: { type: 'document', mimeType: 'application/vnd.ms-excel' },
  xlsx: { type: 'document', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  ppt: { type: 'document', mimeType: 'application/vnd.ms-powerpoint' },
  pptx: { type: 'document', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  txt: { type: 'document', mimeType: 'text/plain' },
  md: { type: 'document', mimeType: 'text/markdown' },
  mp4: { type: 'video', mimeType: 'video/mp4' },
  avi: { type: 'video', mimeType: 'video/x-msvideo' },
  mov: { type: 'video', mimeType: 'video/quicktime' },
  mkv: { type: 'video', mimeType: 'video/x-matroska' },
  mp3: { type: 'audio', mimeType: 'audio/mpeg' },
  wav: { type: 'audio', mimeType: 'audio/wav' },
  flac: { type: 'audio', mimeType: 'audio/flac' },
  zip: { type: 'archive', mimeType: 'application/zip' },
  rar: { type: 'archive', mimeType: 'application/x-rar-compressed' },
  '7z': { type: 'archive', mimeType: 'application/x-7z-compressed' },
  tar: { type: 'archive', mimeType: 'application/x-tar' },
  gz: { type: 'archive', mimeType: 'application/gzip' },
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

export function getFileTypeFromExt(ext: string): { type: FileType, mimeType: string } {
  return EXTENSION_MAP[ext.toLowerCase()] || { type: 'other', mimeType: 'application/octet-stream' }
}

function generateRandomSize(): number {
  const rand = Math.random()
  if (rand < 0.5) return faker.number.int({ min: 1024, max: 512 * 1024 })
  if (rand < 0.8) return faker.number.int({ min: 512 * 1024, max: 10 * 1024 * 1024 })
  if (rand < 0.95) return faker.number.int({ min: 10 * 1024 * 1024, max: 500 * 1024 * 1024 })
  return faker.number.int({ min: 500 * 1024 * 1024, max: 2 * 1024 * 1024 * 1024 })
}

let fileIdCounter = 0
function createFileRecord(name: string, parentId: null | number, path: string): FileRecord {
  fileIdCounter++
  const isFolder = !name.includes('.')
  const ext = isFolder ? '' : name.split('.').pop() || ''
  const fileInfo = isFolder ? { type: 'folder' as FileType, mimeType: 'inode/directory' } : getFileTypeFromExt(ext)
  const size = isFolder ? 0 : generateRandomSize()
  const uploader = UPLOADERS[faker.number.int({ min: 0, max: UPLOADERS.length - 1 })]!
  const createdAt = faker.date.recent({ days: 180 }).toISOString().replace('T', ' ').slice(0, 19)
  const updatedAt = faker.date.between({ from: new Date(createdAt), to: new Date() }).toISOString().replace('T', ' ').slice(0, 19)
  return {
    id: fileIdCounter,
    name,
    type: fileInfo.type,
    extension: ext,
    size,
    sizeDisplay: isFolder ? '-' : formatFileSize(size),
    mimeType: fileInfo.mimeType,
    path,
    parentId,
    uploader: uploader.name,
    uploaderId: uploader.id,
    createdAt,
    updatedAt,
    isFolder,
  }
}

function generateFileData(): FileRecord[] {
  const files: FileRecord[] = []
  const rootFolders = [
    { name: '文档', path: '/文档/' },
    { name: '图片', path: '/图片/' },
    { name: '视频', path: '/视频/' },
    { name: '压缩包', path: '/压缩包/' },
    { name: '音乐', path: '/音乐/' },
    { name: '项目资料', path: '/项目资料/' },
  ]
  const folderMap: Record<number, { id: number, path: string }> = {}
  for (const folder of rootFolders) {
    const record = createFileRecord(folder.name, null, folder.path)
    files.push(record)
    folderMap[record.id] = { id: record.id, path: folder.path }
  }
  const fileTemplates: Record<FileType, string[]> = {
    image: ['产品截图_{word}.png', 'UI设计稿_v{digit}.fig', 'Banner广告_{month}.jpg', '用户头像_{id}.webp', 'Logo设计_final.svg'],
    document: ['项目需求文档_v{version}.docx', '技术方案_{topic}.pdf', '会议纪要_{date}.docx', 'API接口文档.md', '数据分析报告_Q{quarter}.xlsx'],
    video: ['产品演示_v{version}.mp4', '培训视频_{topic}.mp4', '会议录像_{date}.mov'],
    audio: ['会议录音_{date}.mp3', '播客_{episode}.wav', '背景音乐_{mood}.flac'],
    archive: ['源代码备份_{date}.zip', '数据库备份_{date}.tar.gz', '日志归档_{month}.rar'],
    other: ['配置文件_{env}.json', '数据导出_{date}.csv', '字体文件.ttf'],
  }
  for (const [folderId, info] of Object.entries(folderMap)) {
    const numFiles = faker.number.int({ min: 2, max: 5 })
    const types: FileType[] = ['image', 'document', 'video', 'audio', 'archive', 'other']
    for (let i = 0; i < numFiles; i++) {
      const fileType = types[faker.number.int({ min: 0, max: types.length - 1 })]!
      const templates = fileTemplates[fileType]!
      let fileName = templates[faker.number.int({ min: 0, max: templates.length - 1 })]!
      fileName = fileName
        .replace('{word}', faker.word.adjective())
        .replace('{digit}', String(faker.number.int({ min: 1, max: 9 })))
        .replace('{month}', ['一月', '二月', '三月', '四月', '五月', '六月'][faker.number.int({ min: 0, max: 5 })]!)
        .replace('{id}', String(faker.string.uuid().slice(0, 8)))
        .replace('{version}', `${faker.number.int({ min: 1, max: 5 })}.${faker.number.int({ min: 0, max: 9 })}`)
        .replace('{topic}', faker.word.noun())
        .replace('{date}', dayjs(faker.date.recent({ days: 90 })).format('YYYYMMDD'))
        .replace('{quarter}', String(faker.number.int({ min: 1, max: 4 })))
        .replace('{episode}', String(faker.number.int({ min: 1, max: 50 })))
        .replace('{mood}', ['轻松', '激昂', '舒缓'][faker.number.int({ min: 0, max: 2 })]!)
        .replace('{env}', ['dev', 'test', 'prod'][faker.number.int({ min: 0, max: 2 })]!)
      files.push(createFileRecord(fileName, Number(folderId), info.path))
    }
  }
  const rootFiles = ['README.md', '项目说明.pdf', '环境配置.json', '.gitignore']
  for (const name of rootFiles) {
    files.push(createFileRecord(name, null, '/'))
  }
  return files
}

export const FILE_DB = generateFileData()
let autoIncrementId = fileIdCounter + 1

/** 新文件/文件夹自增 id（legacy 在上传与建目录 handler 中直接自增模块变量） */
export function nextFileId(): number {
  return autoIncrementId++
}
