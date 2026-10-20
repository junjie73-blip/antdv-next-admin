export { default as ConfigProvider } from './ConfigProvider.vue';
export type {
  ComponentSizeOption,
  Direction,
  GlobalConfig,
  GlobalTheme,
  LocaleKey,
  ResolvedComponentSize,
  ResolvedGlobalConfig,
} from './types';
export {
  DEFAULT_GLOBAL_CONFIG,
  GLOBAL_CONFIG_KEY,
  normalizeComponentSize,
  textsByLocale,
} from './types';
export { useGlobalConfig } from './use-global-config';
