export interface MicroAppItem {
  /** 子应用唯一标识 */
  name: string;
  /** 子应用访问地址 */
  url: string;
  /** 显示名称 */
  title: string;
  icon?: string;
  /** 是否运行中 */
  active?: boolean;
  baseroute?: string;
  /** 应用描述 */
  description?: string;
  version?: string;
  /** 负责人/团队 */
  owner?: string;
  lastUpdate?: string;
  /** 健康检查地址 */
  healthUrl?: string;
  /** 加载方式：iframe / webcomponent */
  loader?: 'iframe' | 'webcomponent';
  /**
   * 预览 iframe 是否保留同源身份（sandbox 的 allow-same-origin）。
   * 默认 false；打开后与 allow-scripts 组成"sandbox 可逃逸"组合，需要人工确认。
   */
  sameOrigin?: boolean;
}

/**
 * 微前端注册表（应用级配置）。
 *
 * 注意与 `menu.ts` 里的 `MicroAppConfig` 区分：后者是挂在单条路由 meta 上的
 * 子应用加载参数，这里是「有哪些子应用」的全量注册表。
 */
export interface MicroAppRegistry {
  enabled: boolean;
  apps: MicroAppItem[];
}
