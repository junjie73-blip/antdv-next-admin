export type YesNo = '0' | '1'

export type TplCategory = 'crud' | 'tree'

export type TableStatus = 'pending' | 'created'

export type QueryType = 'EQ' | 'NE' | 'GT' | 'LT' | 'LIKE' | 'BETWEEN'

export type HtmlType =
  | 'input'
  | 'textarea'
  | 'inputNumber'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'datetime'
  | 'switch'
  | 'imageUpload'
  | 'fileUpload'

export type TemplateKey =
  | 'controller'
  | 'service'
  | 'repository'
  | 'schema'
  | 'index'
  | 'api'
  | 'vue'
  | 'frontendTypes'
  | 'frontendConstants'
  | 'frontendColumns'
  | 'frontendSchemas'
  | 'frontendActions'
  | 'tableSql'
  | 'menuSql'

/** 生成表字段 */
export interface GenTableColumn {
  columnId?: string
  columnName: string
  columnComment?: string | null
  columnType: string
  length?: number | null
  precision?: number | null
  scale?: number | null
  tsType?: string
  fieldName?: string
  isPk: YesNo
  isIncrement: YesNo
  isRequired: YesNo
  isInsert: YesNo
  isEdit: YesNo
  isList: YesNo
  isQuery: YesNo
  isSort: YesNo
  queryType: QueryType
  htmlType: HtmlType
  dictType?: string | null
  defaultValue?: string | null
  sort?: number
}

/** 生成表 */
export interface GenTable {
  tableId: string
  tableName: string
  tableComment?: string | null
  className: string
  tplCategory: TplCategory
  packageName: string
  moduleName?: string | null
  businessName?: string | null
  functionName?: string | null
  functionAuthor?: string | null
  tableStatus: TableStatus
  createdAt: string
  updatedAt: string
  columns?: GenTableColumn[]
}

export interface GenTableListParams {
  pageNum?: number
  pageSize?: number
  keyword?: string
}

export interface GenTableCreateParams {
  tableName: string
  tableComment?: string | null
  className: string
  tplCategory: TplCategory
  packageName: string
  moduleName?: string | null
  businessName?: string | null
  functionName?: string | null
  functionAuthor?: string | null
  columns: GenTableColumn[]
}

export type GenTableUpdateParams = Partial<Omit<GenTableCreateParams, 'tableName'>>
