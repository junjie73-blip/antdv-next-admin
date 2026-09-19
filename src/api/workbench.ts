import { http } from "~/utils";

// ============================================================
// 工作台
// ============================================================

export const getWorkbenchSummary = (): any => http.Get("/workbench/summary");
