import type { ProjectConfig } from '#/config'

export const projectConfig: ProjectConfig = {
  projectName: import.meta.env.VITE_APP_TITLE,
  table: {
    fetchSetting: {
      listField: 'list',
      pageSizeField: 'pageSize',
      totalField: 'total',
      pageNumField: 'pageNum',
    },
    sortSetting: {
      sortField: 'sort',
      orderField: 'order',
    },
    pageSizeOptions: [10, 30, 50, 100],
    defaultPageSize: 10,
    defaultPageNum: 1,
  },
  routeMap: 'ROUTE_MAPPING',
}
