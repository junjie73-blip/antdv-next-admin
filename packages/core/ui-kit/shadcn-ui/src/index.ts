/**
 * 默认 ui 子包允许在 barrel 里自引自己的样式入口 —— 这是本轮 CSS 重构明确开的口子，
 * 守门在 `@antdv/hooks` 的 boundary.test.ts「只有默认 ui 子包可以在 barrel 里自引 CSS」。
 *
 * 但这条自引**不替代**应用侧的 `@import '@antdv/shadcn-ui/style.css'`：
 * 只有 `@source` 的文件自己不构成 Tailwind root（实测 features=0、产物 13 字节、零工具类），
 * 从 JS 模块图进来等于没登记。真正让本包模板里的工具类生成的是
 * `apps/web/src/styles/index.css` 里那一刀 `@import`。
 */
import './index.css';

export * from './components/accordion';
export * from './components/alert';
export * from './components/alert-dialog';
export * from './components/aspect-ratio';
export * from './components/attachment';
export * from './components/avatar';
export * from './components/badge';
export * from './components/breadcrumb';
export * from './components/bubble';
export * from './components/button';
export * from './components/button-group';
export * from './components/calendar';
export * from './components/card';
export * from './components/carousel';
export * from './components/chat';
export * from './components/checkbox';
export * from './components/collapsible';
export * from './components/combobox';
export * from './components/command';
export * from './components/context-menu';
export * from './components/dialog';
export * from './components/drawer';
export * from './components/dropdown-menu';
export * from './components/empty';
export * from './components/field';
export * from './components/form';
export * from './components/hover-card';
export * from './components/input';
export * from './components/input-group';
export * from './components/input-otp';
export * from './components/item';
export * from './components/kbd';
export * from './components/label';
export * from './components/marker';
export * from './components/menubar';
export * from './components/message';
export * from './components/message-scroller';
export * from './components/native-select';
export * from './components/navigation-menu';
export * from './components/number-field';
export * from './components/pagination';
export * from './components/pin-input';
export * from './components/popover';
export * from './components/progress';
export * from './components/questionnaire';
export * from './components/radio-group';
export * from './components/range-calendar';
export * from './components/resizable';
export * from './components/scroll-area';
export * from './components/select';
export * from './components/separator';
export * from './components/sheet';
export * from './components/sidebar';
export * from './components/skeleton';
export * from './components/slider';
export * from './components/sonner';
export * from './components/spinner';
export * from './components/stepper';
export * from './components/switch';
export * from './components/table';
export * from './components/tabs';
export * from './components/tags-input';
export * from './components/textarea';
export * from './components/toggle';
export * from './components/toggle-group';
export * from './components/tooltip';
