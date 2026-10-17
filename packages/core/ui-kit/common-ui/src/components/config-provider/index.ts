export { default as ConfigProvider } from './ConfigProvider.vue';
export type {
  GlobalConfig,
  ResolvedGlobalConfig,
} from './types';
export {
  DEFAULT_GLOBAL_CONFIG,
  GLOBAL_CONFIG_KEY,
  textsByLocale,
} from './types';
export { useGlobalConfig } from './use-global-config';
