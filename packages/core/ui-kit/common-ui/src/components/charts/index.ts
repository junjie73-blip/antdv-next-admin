/**
 * 图表组件走独立子路径 `@antdv/common-ui/charts`，不进根 barrel：
 * 它 `import * as echarts`，塞进入口会让每个 `from '@antdv/common-ui'` 的消费者
 * 都付出一份图表库的解析成本 —— 与 `@antdv/hooks/echarts` 同一套口径。
 */
export { default, default as ECharts } from './ECharts.vue';
export type { EChartsProps } from './types';
