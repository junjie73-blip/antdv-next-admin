export type WidgetKey =
  | 'fullscreen'
  | 'logout'
  | 'notice'
  | 'preferences'
  | 'search'
  | 'theme'
  | 'timezone';

export interface WidgetMeta {
  key: WidgetKey;
  title: string;
  icon: string;
  component: () => Promise<unknown>;
}
