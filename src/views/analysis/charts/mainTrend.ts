import * as echarts from "echarts";

import { PALETTE } from "../constants";

import {
  axisLineColor,
  baseOption,
  borderColor,
  echartsTheme,
  gradient,
  subTextColor,
} from "../theme";

import type { ActivityTrendData } from "../types";

import { getActivityTrend } from "~/api";

/** 系统活动趋势（主图） */
export async function initMainTrend(el: HTMLElement, isDark: boolean, range: string) {
  const instance = echarts.init(el, echartsTheme(isDark));

  let trendData: ActivityTrendData = { categories: [], pv: [], uv: [], apiCalls: [] };
  try {
    const res = await getActivityTrend(range);
    trendData = res?.data ?? res ?? trendData;
  } catch (e) {
    console.warn("加载活动趋势失败", e);
  }

  instance.setOption(
    baseOption(isDark, {
      legend: {
        data: ["页面访问(PV)", "独立访客(UV)", "API调用"],
        top: 0,
        right: 0,
        textStyle: { color: subTextColor(isDark), fontSize: 12 },
      },
      grid: { left: "3%", right: "4%", top: "36px", bottom: "8%", containLabel: true },
      xAxis: {
        type: "category",
        data: trendData.categories,
        boundaryGap: false,
        axisLine: { lineStyle: { color: axisLineColor(isDark) } },
        axisLabel: { color: subTextColor(isDark), fontSize: 11 },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: "value",
          name: "访问量",
          nameTextStyle: { color: subTextColor(isDark), fontSize: 11 },
          axisLabel: { color: subTextColor(isDark), fontSize: 11 },
          splitLine: {
            lineStyle: { color: borderColor(isDark), type: "dashed", opacity: 0.5 },
          },
        },
        {
          type: "value",
          name: "API",
          nameTextStyle: { color: subTextColor(isDark), fontSize: 11 },
          axisLabel: {
            color: subTextColor(isDark),
            fontSize: 11,
            formatter: (v: number) => `${v / 1000}k`,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "页面访问(PV)",
          type: "line",
          data: trendData.pv,
          smooth: true,
          symbol: "none",
          lineStyle: { color: PALETTE.primary, width: 2.5 },
          areaStyle: {
            color: gradient(["rgba(22,119,255,0.18)", "rgba(22,119,255,0.01)"]),
          },
        },
        {
          name: "独立访客(UV)",
          type: "line",
          data: trendData.uv,
          smooth: true,
          symbol: "none",
          lineStyle: { color: PALETTE.success, width: 2 },
          areaStyle: {
            color: gradient(["rgba(82,196,26,0.12)", "rgba(82,196,26,0.01)"]),
          },
        },
        {
          name: "API调用",
          type: "bar",
          yAxisIndex: 1,
          data: trendData.apiCalls,
          barWidth: 10,
          barGap: "-100%",
          itemStyle: {
            borderRadius: [3, 3, 0, 0],
            color: gradient(["rgba(114,46,209,0.6)", "rgba(114,46,209,0.08)"]),
          },
        },
      ],
      animationDuration: 1200,
    }),
  );

  return instance;
}
