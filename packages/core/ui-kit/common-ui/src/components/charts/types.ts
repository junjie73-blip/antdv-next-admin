import type { EChartsOption } from 'echarts';

export interface EChartsProps {
  /** 图表配置；每次变化都以 `notMerge` 整体重绘 */
  option: EChartsOption;
  /** 容器高度，宽度恒为 100% */
  height?: string;
  /** 显示图表自带的加载遮罩 */
  loading?: boolean;
}
