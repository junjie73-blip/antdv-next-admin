export interface Overview {
  totalRequests: number;
  totalFailures: number;
  successRate: number;
  avgTimeMs: number;
  p95TimeMs: number;
  totalLogins: number;
  loginFailures: number;
  uniqueUsers: number;
}

export interface TrendData {
  dates: string[];
  requests: number[];
  failures: number[];
  successRates: number[];
  avgTimes: number[];
  p95Times: number[];
  logins: number[];
  loginFailures: number[];
}

export interface TopOperation {
  operation: string;
  operationLabel: string;
  totalCount: number;
  failCount: number;
  failRate: number;
  avgTimeMs: number;
  p95TimeMs: number;
}
