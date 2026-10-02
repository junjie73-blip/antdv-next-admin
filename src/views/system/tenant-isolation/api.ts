import { http } from '~/utils'

import type { IsolationOverview, IsolationRun, IsolationTrend, RuleDistribution, TableHeat } from './types'

const BASE = '/system/tenant-isolation/dashboard'

export const getOverview = () => http.Get<IsolationOverview>(`${BASE}/overview`).send(true)

export const getTrend = (days = 30) => http.Get<IsolationTrend>(`${BASE}/trend`, { params: { days } }).send(true)

export const getRuleDistribution = () => http.Get<RuleDistribution[]>(`${BASE}/rule-distribution`).send(true)

export const getTableHeatmap = () => http.Get<TableHeat[]>(`${BASE}/table-heatmap`).send(true)

export const getRecentRuns = () => http.Get<IsolationRun[]>(`${BASE}/recent-runs`).send(true)
