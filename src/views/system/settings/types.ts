/** 系统配置记录（对齐后端 sys_config 表） */
export interface ConfigRecord {
  configId: string;
  configKey: string;
  configValue?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}
