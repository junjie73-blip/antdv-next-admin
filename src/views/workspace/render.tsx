import type { LogItem } from "./types";
import { LOG_STATUS_COLOR_MAP, LOG_STATUS_LABEL_MAP } from "./constants";
import { formatLogTime } from "./utils";

/**
 * 渲染「最近操作」列表项
 * 保持为独立渲染函数，避免在 index.vue 中引入 JSX
 */
export function renderLogItem(item: LogItem) {
  const style = LOG_STATUS_COLOR_MAP[item.status] ?? LOG_STATUS_COLOR_MAP["0"];
  const label = LOG_STATUS_LABEL_MAP[item.status] ?? "未知";

  return (
    <div class="group flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
      <span
        class="inline-flex items-center justify-center w-14 h-5 rounded text-[11px] font-medium flex-shrink-0"
        style={{ backgroundColor: style?.bg || "", color: style?.color || "" }}
      >
        {label}
      </span>
      <span class="text-[13px] font-medium text-gray-700 dark:text-gray-200 w-24 truncate flex-shrink-0">
        {item.username || "-"}
      </span>
      <span class="text-[13px] text-gray-500 dark:text-gray-400 flex-1 truncate">
        {item.operation}
      </span>
      <span class="text-xs text-gray-400 tabular-nums flex-shrink-0">
        {formatLogTime(item.created_at)}
      </span>
    </div>
  );
}
