import type { FormSchema } from '@antdv/form-ui';
import type { ActionItem } from '@antdv/table-ui';

export type StatTone = 'amber' | 'blue' | 'green' | 'red' | 'violet';

export interface DataStat {
  icon?: string;
  label: string;
  tone?: StatTone;
  value: string;
}

export interface DataFilter {
  key: string;
  label: string;
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
}

export interface DataColumn {
  key: string;
  title: string;
  width?: string;
}

export type DataRow = Record<string, any>;

export interface DataListResult {
  list: DataRow[];
  total: number;
}

/**
 * 写入钩子返回 `false` 表示「业务校验没过，保持弹层打开」。
 * 提供服务端 api 后，增删改都先走这里；不提供则沿用组件内的本地 rows 行为。
 */
export type DataWriteHook<T = boolean | void> = (
  values: Record<string, any>,
  editingKey: null | string,
  row?: DataRow,
) => Promise<T> | T;

export interface DataPageProps {
  /** 服务端数据源；提供后替代本地 rows 的过滤与切片 */
  api?: (params: Record<string, any>) => Promise<DataListResult>;
  /** 行内最多显示几个操作，超出收进「更多」（默认 4） */
  actionMaxShowCount?: number;
  /** 详情抽屉宽度（px），流程类页面可传更宽以免节点被挤小 */
  detailWidth?: number;
  /** 宿主追加的操作项，统一由 TableAction 渲染，排在「详情」之前 */
  extraActions?: ((row: DataRow) => ActionItem[]) | ActionItem[];
  /** 行级编辑权限：返回 false 时隐藏编辑入口（默认全部允许） */
  canEditRow?: (row: DataRow) => boolean;
  /** 行级删除权限：返回 false 时隐藏删除入口（默认全部允许） */
  canDeleteRow?: (row: DataRow) => boolean;
  /** 新建/编辑提交；返回 false 阻止关闭弹层 */
  onSubmit?: DataWriteHook;
  /** 单条删除；返回 false 视为放弃 */
  onRemove?: (row: DataRow) => boolean | Promise<boolean | void> | void;
  /** 批量删除；返回 false 视为放弃 */
  onRemoveSelected?: (
    rows: DataRow[],
  ) => boolean | Promise<boolean | void> | void;
  /** 操作列宽度；带「排期 / 进度」等额外按钮时页面侧调宽 */
  actionWidth?: number;
  /** 自定义新建/编辑表单 Schema；不传时按 columns 推导成 Input */
  createSchemas?: FormSchema[];
  /** 是否展示删除类操作（阶段/里程碑属于项目排期的一部分，默认页面不单独删） */
  showDelete?: boolean;
  /** 页面侧改用自定义操作入口时，可隐藏标题栏的默认新建按钮 */
  showCreate?: boolean;
  /** 新建面板的字段（默认取 columns 前三项） */
  createFields?: string[];
  createLabel?: string;
  description?: string;
  icon?: string;
  primaryKey?: string;
  /** 只读台账：隐藏新建/编辑/删除，仅保留查询与详情 */
  readonly?: boolean;
  rows?: DataRow[];
  stats?: DataStat[];
  statusColors?: Record<string, string>;
  /** 状态值 → 中文文案；不传时直接展示原始值 */
  statusLabels?: Record<string, string>;
  statusKey?: string;
  title: string;
  columns: DataColumn[];
  filters?: DataFilter[];
}
