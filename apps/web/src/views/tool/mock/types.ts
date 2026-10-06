import type { MockRouteItem } from '~/api/mock';

/** 接口清单行：控制面条目 + 面板派生字段 */
export interface MockRouteRow extends MockRouteItem {
  /** 生成接口的标识（取自落地文件名），源码接口为空串 */
  id: string;
  /** 行主键 */
  rowKey: string;
}

/** 新增 / 编辑自定义接口的表单值（method + path 由页面拼成接口标识 key） */
export interface DefinitionFormValues {
  id: string;
  message: string;
  method: string;
  path: string;
  /** 选中的预置模板名，仅用于覆盖模板，不提交 */
  preset?: string;
  template: string;
  title: string;
}

/** 单接口运行时配置表单值 */
export interface RouteRuntimeFormValues {
  delay: number;
  /** 是否单独设置延迟，关闭时跟随全局默认延迟 */
  useCustomDelay: boolean;
  disabled: boolean;
  failRate: number;
  /** 是否单独设置失败率，关闭时跟随全局 */
  useCustomFailRate: boolean;
  /** 注入失败时返回的 HTTP 状态码 */
  status: number;
}

/** 运行时配置抽屉的编辑目标 */
export interface RuntimeTarget {
  effective: MockRouteItem['effective'];
  id: string;
  key: string;
  /** 该接口是否已有单接口覆盖 */
  overridden: boolean;
  path: string;
}
