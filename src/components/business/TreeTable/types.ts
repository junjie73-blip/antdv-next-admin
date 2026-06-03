import type { BasicColumn } from '@/components/business/Table/types'

export interface TreeDataNode {
  key: string
  title: string
  children?: TreeDataNode[]
  [key: string]: any
}

export interface TreeTableFetchParams {
  treeKey: string
  page: number
  pageSize: number
}

export interface TreeTableProps {
  treeTitle?: string
  treeData: TreeDataNode[]
  treeDefaultExpandAll?: boolean
  treeSearchPlaceholder?: string
  treeWidth?: number
  treeMinWidth?: number
  treeMaxWidth?: number
  tableTitle?: string
  tableColumns: BasicColumn[]
  tableApi?: (params: TreeTableFetchParams) => Promise<{
    list: any[]
    total: number
  }>
  tableRowKey?: string
  tablePageSize?: number
  showSearch?: boolean
  treeEmptyText?: string
  tableEmptyText?: string
}
