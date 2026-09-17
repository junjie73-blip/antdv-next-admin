
import * as echarts from "echarts";

import { PALETTE } from "../constants";
import { borderColor, echartsTheme, gradient, subTextColor, textColor } from "../theme";

import type { ModuleRankItem } from "../types";
import type { ChartInitResult } from "./types";

import { getModuleRank } from "@/api";

/** 模块使用热度排行（带自动刷新） */
export async function initModuleRank(
  el: HTMLElement,
  isDark: boolean,
): Promise<ChartInitResult | { instance: echarts.ECharts }> {
  const instance = echarts.init(el, echartsTheme(isDark));

  async function update() {
    let sorted: ModuleRankItem[] = [];
    try {
      const res = await getModuleRank();
      sorted = res?.data ?? res ?? [];
    } catch (e) {
      console.warn("加载模块排行失败", e);
    }

    instance.setOption({
      grid: { left: "2%", right: "8%", top: "2%", bottom: "2%", containLabel: true },
      xAxis: {
        type: "value",
        axisLabel: { color: subTextColor(isDark), fontSize: 10 },
        splitLine: {
          lineStyle: { color: borderColor(isDark), type: "dashed", opacity: 0.4 },
        },
      },
      yAxis: {
        type: "category",
        data: sorted.map((d) => d.name),
        axisLabel: { color: textColor(isDark), fontSize: 12 },
        axisTick: { show: false },
        axisLine: { show: false },
        inverse: true,
      },
      series: [
        {
          type: "bar",
          data: sorted.map((d) => ({
            value: d.value,
            itemStyle: {
              color: gradient([PALETTE.primary, "rgba(22,119,255,0.25)"], false),
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barWidth: 16,
          label: {
            show: true,
            position: "right",
            color: subTextColor(isDark),
            fontSize: 11,
            formatter: "{c}",
          },
          animationDuration: 800,
          animationEasing: "cubicInOut",
        },
      ],
    });
  }

  await update();

  // 每 15 秒自动刷新
  const timer = setInterval(update, 15000);

  return {
    instance,
    cleanup: () => clearInterval(timer),
  };
}
