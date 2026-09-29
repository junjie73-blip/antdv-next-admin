import { http } from "~/utils";
import type { Overview, TopOperation, TrendData } from "./types";

export interface QueryParams {
  startDate: string;
  endDate: string;
  operation?: string;
}

export function getOverview(params: QueryParams) {
  return http.Get<{ data: Overview }>("/monitor/audit-daily/overview", { params }).send(true);
}

export function getTrend(params: QueryParams) {
  return http.Get<{ data: TrendData }>("/monitor/audit-daily/trend", { params }).send(true);
}

export function getTopOperations(params: QueryParams & { limit?: number }) {
  return http
    .Get<{ data: TopOperation[] }>("/monitor/audit-daily/top-operations", { params })
    .send(true);
}

export function getOperationList() {
  return http.Get<{ data: string[] }>("/monitor/audit-daily/operations").send(true);
}

export function triggerAggregate(data: { date?: string }) {
  return http.Post("/monitor/audit-daily/aggregate", data).send(true);
}

export function triggerClean() {
  return http.Post("/monitor/audit-daily/clean").send(true);
}
