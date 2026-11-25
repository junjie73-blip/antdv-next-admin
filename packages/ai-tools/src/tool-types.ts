/** 四个核心工具的参数与结果契约，由 packages/ai-tools/src/runtime.ts 消费。 */
import type { FilterSpec, JsonSchemaObject, SortSpec } from './types';

export interface SearchTableArgs {
  utterance: string;
  target?: string;
}

export interface SearchTableResult {
  applied: boolean;
  filters: FilterSpec[];
  sorts: SortSpec[];
  summary: string;
}

export interface GenerateFormArgs {
  description: string;
  template?: string;
}

export interface GenerateFormResult {
  formId: string;
  opened: boolean;
  schema: JsonSchemaObject;
}

export interface FillFormFieldsArgs {
  fields?: string[];
  source?: 'context' | 'description' | 'history';
}

export interface FillFormFieldsResult {
  confidence: Record<string, number>;
  filled: string[];
  skipped: string[];
  values: Record<string, unknown>;
}

export interface NavigateToArgs {
  utterance: string;
}
