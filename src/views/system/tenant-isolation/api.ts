import { request } from '~/composables'

import type { IsolationOverview, IsolationRun, IsolationTrend, RuleDistribution, TableHeat } from './types'

const BASE = '/system/tenant-isolation/dashboard'

export const getOverview = () => request.get<IsolationOverview>(`${BASE}/overview`)

export const getTrend = (days = 30) => request.get<IsolationTrend>(`${BASE}/trend`, { days })

export const getRuleDistribution = () => request.get<RuleDistribution[]>(`${BASE}/rule-distribution`)

export const getTableHeatmap = () => request.get<TableHeat[]>(`${BASE}/table-heatmap`)

export const getRecentRuns = () => request.get<IsolationRun[]>(`${BASE}/recent-runs`)
