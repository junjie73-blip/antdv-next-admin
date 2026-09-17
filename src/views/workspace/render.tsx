import type { LogItem } from "./types";
import { LOG_STATUS_COLOR_MAP, LOG_STATUS_LABEL_MAP } from "./constants";
import { formatLogTime } from "./utils";

export function renderLogItem(item: LogItem) {
  const style = LOG_STATUS_COLOR_MAP[item.status] ?? LOG_STATUS_COLOR_MAP["0"];
  const label = LOG_STATUS_LABEL_MAP[item.status] ?? "未知";

  return (
    <div class="group cursor-pointer flex items-center gap-4 px-5 py-3 border-b border-slate-100/70 dark:border-slate-800/60 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
      <span
        class="inline-flex items-center justify-center w-14 h-6 rounded-full text-[11px] font-medium shrink-0"
        style={{ backgroundColor: style?.bg || "", color: style?.color || "" }}
      >
        {label}
      </span>
      <span class="text-[13px] font-medium text-slate-700 dark:text-slate-200 w-24 truncate shrink-0">
        {item.username || "-"}
      </span>
      <span class="text-[13px] text-slate-500 dark:text-slate-400 flex-1 truncate">
        {item.operation}
      </span>
      <span class="text-xs text-slate-400 tabular-nums shrink-0">
        {formatLogTime(item.created_at)}
      </span>
    </div>
  );
}
