import type { InjectionKey } from 'vue';

/**
 * 全局系统配置：跨组件共用的默认值与文案。
 *
 * 只放"组件库自己能决定、但每个项目又想改"的那部分——按钮文案、尺寸档位、
 * 空状态占位。主题色、圆角这类**渲染成 CSS 变量**的归 `@antdv/preferences`，
 * 不在这里重复一份，否则同一个配置会有两个写侧。
 */
export interface GlobalConfig {
  /** 内置确认/取消按钮的文案覆盖；不给则按 `locale` 取内置词条 */
  cancelText?: string;
  /** 组件默认尺寸档位，与 shadcn 的 `size` 口径一致 */
  componentSize?: 'large' | 'medium' | 'small';
  /** 界面语言，决定内置文案（目前内置 zh-CN 与英文两套） */
  locale?: 'en-US' | 'zh-CN';
  okText?: string;
  /** 空值占位符 */
  placeholder?: string;
}

/** 已解析的配置：`GlobalConfig` 里可选的字段在这里都有值 */
export interface ResolvedGlobalConfig extends Required<GlobalConfig> {}

/**
 * 注入键。
 *
 * `ConfigProvider` 嵌套时内层只覆盖自己声明的字段（见 `ConfigProvider.vue`），
 * 所以注入的值始终是"从外到内合并完"的完整配置，消费方不必自己做链式合并。
 * 类型为 `| null`：最外层 provider 需要区分"上面没有配置"与"上面配置成默认值"，
 * 前者才按 `locale` 展开词条。
 */
export const GLOBAL_CONFIG_KEY: InjectionKey<ResolvedGlobalConfig | null> =
  Symbol('antdv-global-config');

/** 未挂 `ConfigProvider` 时的兜底配置：中文、中等尺寸 */
export const DEFAULT_GLOBAL_CONFIG: ResolvedGlobalConfig = {
  cancelText: '取消',
  componentSize: 'medium',
  locale: 'zh-CN',
  okText: '确定',
  placeholder: '-',
};

/** 按语言取内置词条，`ConfigProvider` 用它把 `locale` 展开成文案 */
export function textsByLocale(locale: 'en-US' | 'zh-CN'): {
  cancelText: string;
  okText: string;
} {
  return locale === 'zh-CN'
    ? { cancelText: '取消', okText: '确定' }
    : { cancelText: 'Cancel', okText: 'OK' };
}
