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
      sortField: 'sortOrder',
      orderField: 'order',
    },
    pageSizeOptions: [10, 30, 50, 100],
    defaultPageSize: 10,
    defaultPageNum: 1,
  },
  routeMap: 'ROUTE_MAPPING',
  scrollbar: {
    // Whether to use native scroll bar
    // After opening, the menu, modal, drawer will change the pop-up scroll bar to native
    native: false,
  },
}
