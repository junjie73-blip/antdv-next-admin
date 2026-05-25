import type { UploadProps as AntUploadProps, UploadFile } from 'antdv-next'

/**
 * Upload 组件属性
 */
export interface UploadProps extends Omit<AntUploadProps, 'onChange'> {
  /**
   * 上传地址
   */
  action?: string

  /**
   * 文件列表
   */
  value?: UploadFile[]

  /**
   * 是否多选
   * @default false
   */
  multiple?: boolean

  /**
   * 最大文件数量
   */
  maxCount?: number

  /**
   * 文件大小限制（MB）
   */
  maxSize?: number

  /**
   * 接受的文件类型
   */
  accept?: string

  /**
   * 是否显示上传列表
   * @default true
   */
  showUploadList?: boolean

  /**
   * 列表类型
   * @default 'text'
   */
  listType?: 'text' | 'picture' | 'picture-card'

  /**
   * 上传按钮文字
   */
  uploadText?: string

  /**
   * 上传按钮图标
   */
  uploadIcon?: string

  /**
   * 是否禁用
   * @default false
   */
  disabled?: boolean

  /**
   * 是否只读
   * @default false
   */
  readonly?: boolean

  /**
   * 自定义上传方法
   */
  customRequest?: (options: any) => void

  /**
   * 上传前钩子
   */
  beforeUpload?: (file: UploadFile, fileList: UploadFile[]) => boolean | Promise<boolean>

  /**
   * 文件变化回调
   */
  onChange?: (fileList: UploadFile[]) => void

  /**
   * 上传成功回调
   */
  onSuccess?: (response: any, file: UploadFile) => void

  /**
   * 上传失败回调
   */
  onError?: (error: Error, file: UploadFile) => void

  /**
   * 删除文件回调
   */
  onRemove?: (file: UploadFile) => boolean | Promise<boolean>
}

/**
 * Upload 组件实例方法
 */
export interface UploadInstance {
  /**
   * 获取文件列表
   */
  getFileList: () => UploadFile[]

  /**
   * 设置文件列表
   */
  setFileList: (fileList: UploadFile[]) => void

  /**
   * 清空文件列表
   */
  clear: () => void

  /**
   * 上传所有文件
   */
  upload: () => void
}
