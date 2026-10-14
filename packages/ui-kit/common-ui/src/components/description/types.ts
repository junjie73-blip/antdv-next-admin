import type { VNodeChild } from 'vue';

/**
 * 通用记录类型：迁移前从 `@antdv/form-ui` 引入，为去掉跨包依赖在此就地定义等价类型。
 */
export type Recordable<T = any> = Record<string, T>;

/**
 * Description 组件尺寸
 */
/**
 * 旧组件库已经把 `size="default"` 判为废弃（控制台会提示改用 `large`），
 * 所以这里不再提供 `'default'`：不传 = 组件默认，`large` 与不传渲染一致。
 */
export type DescriptionSize = 'large' | 'middle' | 'small';

/**
 * Description 组件布局
 */
export type DescriptionLayout = 'horizontal' | 'vertical';

/**
 * Description 组件边框样式
 */
export type DescriptionBordered = 'bordered' | 'none' | boolean;
export type DescriptionFieldType =
  | 'date'
  | 'datetime'
  | 'dict'
  | 'image'
  | 'images'
  | 'tag'
  | 'text';
/**
 * DescriptionItem 配置项
 */
export interface DescriptionItem {
  /**
   * 字段名
   */
  field: string;

  /**
   * 标签文本
   */
  label?: string;

  /**
   * 内容值
   */
  value?: any;

  /**
   * 是否显示
   * @default true
   */
  show?: boolean;

  /**
   * 占据的列数
   * @default 1
   */
  span?: number;

  /**
   * 自定义渲染内容
   */
  render?: (value: any, record: Recordable) => VNodeChild;

  /**
   * 自定义标签渲染
   */
  renderLabel?: (label: string, record: Recordable) => VNodeChild;

  /**
   * 内容样式
   */
  contentStyle?: Record<string, string>;

  /**
   * 标签样式
   */
  labelStyle?: Record<string, string>;
  /** 字段渲染类型 */
  type?: DescriptionFieldType;

  /** 字典编码（type='dict' 时必填） */
  dictType?: string;

  /** 日期格式（type='date' / 'datetime' 时使用） */
  dateFormat?: string;

  /** 图片尺寸（type='image' / 'images' 时使用） */
  imageSize?: number;
}

/**
 * Description 组件属性
 */
export interface DescriptionProps {
  /**
   * 标题
   */
  title?: string;

  /**
   * 数据源
   */
  data?: Recordable;

  /**
   * 配置项数组
   */
  schema?: DescriptionItem[];

  /**
   * 每行显示的列数
   * @default 3
   */
  column?: number;

  /**
   * 尺寸；不传走旧组件库的默认档（宽松）。
   * 注意没有 `'default'` —— 那个写法已被旧组件库判为废弃。
   */
  size?: DescriptionSize;

  /**
   * 布局方式
   * @default 'horizontal'
   */
  layout?: DescriptionLayout;

  /**
   * 是否显示边框
   * @default false
   */
  bordered?: boolean;

  /**
   * 是否显示冒号
   * @default true
   */
  colon?: boolean;

  /**
   * 是否加载中
   * @default false
   */
  loading?: boolean;

  /**
   * 空值显示文本
   * @default '-'
   */
  emptyText?: string;

  /**
   * 自定义类名
   */
  className?: string;

  /**
   * 自定义样式
   */
  style?: Record<string, string>;
}

/**
 * Description 组件实例方法
 */
export interface DescriptionInstance {
  /**
   * 获取数据源
   */
  getData: () => Recordable | undefined;

  /**
   * 设置数据源
   */
  setData: (data: Recordable) => void;
}
