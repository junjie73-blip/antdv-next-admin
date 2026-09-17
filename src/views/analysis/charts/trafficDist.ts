
import * as echarts from "echarts";

import { PALETTE } from "../constants";
import { baseOption, echartsTheme, subTextColor, textColor } from "../theme";

import { getTrafficDistribution } from "@/api";

/** 流量来源分布（环形饼图） */
export async function initTrafficDist(el: HTMLElement, isDark: boolean): Promise<echarts.ECharts> {
  const instance = echarts.init(el, echartsTheme(isDark));

  let data: any[] = [];
  try {
    const res = await getTrafficDistribution();
    data = res?.data ?? res ?? [];
  } catch (e) {
    console.warn("加载流量分布失败", e);
  }

  instance.setOption(
    baseOption(isDark, {
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      legend: {
        orient: "vertical",
        right: "2%",
        top: "center",
        textStyle: { color: subTextColor(isDark), fontSize: 12 },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 14,
        icon: "circle",
      },
      series: [
        {
          type: "pie",
          radius: ["42%", "72%"],
          center: ["38%", "50%"],
          padAngle: 2,
          itemStyle: {
            borderRadius: 6,
            borderColor: isDark ? "#111827" : "#fff",
            borderWidth: 2,
          },
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: "bold",
              color: textColor(isDark),
            },
            scaleSize: 8,
          },
          data,
          color: [
            PALETTE.primary,
            PALETTE.success,
            PALETTE.warning,
            PALETTE.info,
            PALETTE.cyan,
            PALETTE.danger,
          ],
        },
      ],
    }),
  );

  return instance;
}
