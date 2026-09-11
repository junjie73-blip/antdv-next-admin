import * as echarts from "echarts";
import { getErrorRateTrend } from "@/api/system";
import { PALETTE } from "../constants";
import { baseOption, borderColor, echartsTheme, gradient, subTextColor } from "../theme";
import type { ErrorRateData } from "../types";

/** API 错误率趋势 */
export async function initErrorRate(el: HTMLElement, isDark: boolean) {
  const instance = echarts.init(el, echartsTheme(isDark));

  let data: ErrorRateData = { hours: [], errorRates: [], errors4xx: [], errors5xx: [] };
  try {
    const res = await getErrorRateTrend();
    data = res?.data ?? res ?? data;
  } catch (e) {
    console.warn("加载错误率失败", e);
  }

  instance.setOption(
    baseOption(isDark, {
      legend: {
        data: ["总错误率", "4xx 客户端错误", "5xx 服务端错误"],
        top: 0,
        textStyle: { color: subTextColor(isDark), fontSize: 10 },
      },
      grid: { left: "3%", right: "4%", top: "32px", bottom: "10%", containLabel: true },
      xAxis: {
        type: "category",
        data: data.hours,
        axisLabel: { color: subTextColor(isDark), fontSize: 9, interval: 2 },
        axisLine: { lineStyle: { color: borderColor(isDark) } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        name: "错误率 (%)",
        nameTextStyle: { color: subTextColor(isDark), fontSize: 10 },
        axisLabel: { color: subTextColor(isDark), fontSize: 9, formatter: "{value}%" },
        splitLine: {
          lineStyle: { color: borderColor(isDark), type: "dashed", opacity: 0.4 },
        },
      },
      series: [
        {
          name: "总错误率",
          type: "line",
          data: data.errorRates,
          smooth: true,
          symbol: "none",
          lineStyle: { color: PALETTE.danger, width: 2 },
          areaStyle: {
            color: gradient(["rgba(255,77,79,0.15)", "rgba(255,77,79,0.01)"]),
          },
        },
        {
          name: "4xx 客户端错误",
          type: "bar",
          data: data.errors4xx,
          barWidth: 6,
          itemStyle: { color: PALETTE.warning, borderRadius: [2, 2, 0, 0] },
        },
        {
          name: "5xx 服务端错误",
          type: "bar",
          data: data.errors5xx,
          barWidth: 6,
          itemStyle: { color: PALETTE.danger, borderRadius: [2, 2, 0, 0] },
        },
      ],
      animationDuration: 1200,
    }),
  );

  return instance;
}
