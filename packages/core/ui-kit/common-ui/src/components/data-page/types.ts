export type StatTone = 'amber' | 'blue' | 'green' | 'red' | 'violet';

export interface DataStat {
  icon?: string;
  label: string;
  tone?: StatTone;
  value: string;
}

export interface DataFilter {
  key: string;
  label: string;
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
}

export interface DataColumn {
  key: string;
  title: string;
  width?: string;
}

export type DataRow = Record<string, string>;

export interface DataPageProps {
  /** 新建面板的字段（默认取 columns 前三项） */
  createFields?: string[];
  createLabel?: string;
  description?: string;
  icon?: string;
  primaryKey?: string;
  rows: DataRow[];
  stats?: DataStat[];
  statusColors?: Record<string, string>;
  statusKey?: string;
  title: string;
  columns: DataColumn[];
  filters?: DataFilter[];
}
