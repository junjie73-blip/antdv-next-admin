/**
 * ECharts 集中注册模块
 * - 统一注册所有扩展
 * - 只在客户端执行（SSR 友好）
 * - 幂等：重复 import 只执行一次
 */

import {
  BarChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  SankeyChart,
} from 'echarts/charts';
import {
  AriaComponent,
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  PolarComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

let installed = false;

/**
 * 安装 ECharts 核心 + 所有需要的图表/组件/渲染器。
 * 必须在任何 `echarts.init` 之前调用一次。
 */
export function setupEcharts(): void {
  if (installed) return;
  installed = true;

  // 1. 核心图表 & 组件
  echarts.use([
    // 图表
    LineChart,
    BarChart,
    PieChart,
    RadarChart,
    FunnelChart,
    GaugeChart,
    HeatmapChart,
    SankeyChart,

    // 组件
    TitleComponent,
    TooltipComponent,
    LegendComponent,
    GridComponent,
    DataZoomComponent,
    VisualMapComponent,
    PolarComponent,
    GraphicComponent,
    MarkLineComponent,
    AriaComponent,

    // 渲染器
    CanvasRenderer,
  ]);
}
