/** 字典项记录 */
export interface DictItemRecord {
  dictDataId: string;
  dictLabel: string;
  dictValue: string;
  sortOrder: number;
  /** '0'-停用 '1'-正常 */
  status: string;
  remark?: string;
  createdAt?: string;
}

/** 字典类型记录 */
export interface DictTypeRecord {
  dictTypeId: string;
  dictName: string;
  dictCode: string;
  /** '0'-停用 '1'-正常 */
  status: string;
  description?: string;
}
