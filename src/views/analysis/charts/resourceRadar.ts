import * as echarts from "echarts";
import { getResourceUsage } from "@/api";
import { PALETTE } from "../constants";
import { baseOption, borderColor, echartsTheme, subTextColor } from "../theme";
import type { ResourceUsageData } from "../types";

/** 资源使用雷达图 */
export async function initResourceRadar(el: HTMLElement, isDark: boolean) {
  const instance = echarts.init(el, echartsTheme(isDark));

  let usage: ResourceUsageData = { indicators: [], current: [], peak: [] };
  try {
    const res = await getResourceUsage();
    usage = res?.data ?? res ?? usage;
  } catch (e) {
    console.warn("加载资源使用失败", e);
  }

  instance.setOption(
    baseOption(isDark, {
      legend: {
        data: ["当前", "峰值"],
        bottom: 0,
        textStyle: { color: subTextColor(isDark), fontSize: 12 },
      },
      radar: {
        indicator: usage.indicators,
        axisName: { color: subTextColor(isDark), fontSize: 11 },
        splitArea: {
          areaStyle: {
            color: [
              isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
              isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
            ],
          },
        },
        splitLine: { lineStyle: { color: borderColor(isDark), opacity: 0.4 } },
        axisLine: { lineStyle: { color: borderColor(isDark), opacity: 0.4 } },
      },
      series: [
        {
          name: "当前",
          type: "radar",
          data: [{ value: usage.current, name: "当前" }],
          symbol: "circle",
          symbolSize: 5,
          lineStyle: { color: PALETTE.primary, width: 2 },
          areaStyle: { color: "rgba(22,119,255,0.18)" },
          itemStyle: { color: PALETTE.primary },
        },
        {
          name: "峰值",
          type: "radar",
          data: [{ value: usage.peak, name: "峰值" }],
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { color: PALETTE.danger, width: 1.5, type: "dashed" },
          areaStyle: { color: "rgba(255,77,79,0.06)" },
          itemStyle: { color: PALETTE.danger },
        },
      ],
    }),
  );

  return instance;
}
