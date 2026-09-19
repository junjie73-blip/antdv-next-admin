import * as echarts from "echarts";

import { PALETTE } from "../constants";
import { baseOption, echartsTheme, subTextColor, textColor } from "../theme";

import { getSystemHealth } from "~/api";

/** 系统健康度仪表盘 */
export async function initSystemHealth(el: HTMLElement, isDark: boolean) {
  const instance = echarts.init(el, echartsTheme(isDark));

  let health = 0;
  try {
    const res = await getSystemHealth();
    health = (res?.data ?? res)?.health ?? 0;
  } catch (e) {
    console.warn("加载系统健康度失败", e);
  }

  instance.setOption(
    baseOption(isDark, {
      series: [
        {
          type: "gauge",
          startAngle: 210,
          endAngle: -30,
          radius: "92%",
          min: 0,
          max: 100,
          axisLine: {
            lineStyle: {
              width: 14,
              color: [
                [0.35, PALETTE.success],
                [0.65, PALETTE.warning],
                [1, PALETTE.danger],
              ],
            },
          },
          pointer: { length: "58%", width: 4, itemStyle: { color: "auto" } },
          axisTick: { length: 6, lineStyle: { color: "auto", width: 1.5 } },
          splitLine: { length: 12, lineStyle: { color: "auto", width: 2 } },
          axisLabel: { color: subTextColor(isDark), distance: 18, fontSize: 10 },
          detail: {
            valueAnimation: true,
            formatter: "{value}%",
            color: textColor(isDark),
            fontSize: 26,
            fontWeight: 700,
            offsetCenter: [0, "55%"],
          },
          title: { show: false },
          data: [{ value: health }],
          animationDuration: 1800,
        },
      ],
    }),
  );

  return instance;
}
