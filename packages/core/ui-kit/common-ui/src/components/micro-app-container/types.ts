export interface MicroAppContainerProps {
  /** micro-app 实例名，同时是事件名前缀（`mounted-${name}` 等） */
  name: string;
  /** 子应用入口地址；不传时组件展示「未配置应用地址」占位 */
  url?: string;
  className?: string;
  baseroute?: string;
  keepAlive?: boolean;
  disableMemoryRouter?: boolean;
  disablePatchRequest?: boolean;
}

export interface MicroAppContainerEmits {
  beforeload: [];
  mounted: [];
  unmount: [];
  error: [error: Error];
}
