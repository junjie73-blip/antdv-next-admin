/** 状态颜色映射 */
export const LOGIN_STATUS_COLOR_MAP: Record<string, string> = {
  "1": "green",
  "0": "red",
};

/** 状态文案映射 */
export const LOGIN_STATUS_LABEL_MAP: Record<string, string> = {
  "1": "成功",
  "0": "失败",
};

/** 状态下拉选项 */
export const LOGIN_STATUS_OPTIONS = [
  { label: "成功", value: "1" },
  { label: "失败", value: "0" },
];
