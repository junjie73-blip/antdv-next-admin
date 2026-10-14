export interface UploadFile {
  error?: any;
  name: string;
  percent?: number;
  response?: any;
  size?: number;
  status?: 'done' | 'error' | 'removed' | 'uploading';
  thumbUrl?: string;
  uid: string;
  url?: string;
  [k: string]: any;
}

export interface UploadChangeParam {
  file: UploadFile;
  fileList: UploadFile[];
  event?: any;
}

export type UploadListType = 'picture' | 'picture-card' | 'text';

export interface UploadRequestOptions {
  file: File;
  filename: string;
  onSuccess?: (res: any) => void;
  onError?: (err: any) => void;
  onProgress?: (e: { percent: number }) => void;
}

export interface UploadProps {
  accept?: string;
  autoUpload?: boolean;
  beforeUpload?: (file: File, list: File[]) => any;
  customRequest?: (options: UploadRequestOptions) => (() => void) | void;
  disabled?: boolean;
  drag?: boolean;
  fileList?: UploadFile[];
  listType?: UploadListType;
  maxCount?: number;
  multiple?: boolean;
  previewFile?: (file: UploadFile) => Promise<string> | string;
  showUploadList?: boolean;
}
