export interface ProjectConfig {
  projectName: string
  table: {
    fetchSetting: {
      listField: string
      pageSizeField: string
      totalField: string
      pageNumField: string
    }
    sortSetting: {
      sortField: string
      orderField: string
    }
    pageSizeOptions: number[]
    defaultPageSize: number
    defaultPageNum: number
  }
  routeMap: string
}
