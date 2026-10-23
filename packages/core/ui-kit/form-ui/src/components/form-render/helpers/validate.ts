import type { FormValidateError, Recordable } from '../../../types';

/** 一个字段校验不通过时对外报告的样子 */
export interface ErrorField {
  errors: string[];
  name: string;
}

/**
 * 组装校验失败时要抛出的对象。
 *
 * 形状照 antd：`name` 是字段路径数组，`message` 是第一条错误文案 —— 页面会用它拼提示语，
 * `steps` 那类向导还按 `errorFields[0].name[0]` 反查该跳回哪一步。
 * 同一文案在 change / submit 两种 cause 下会分别写入 meta，对外只报一条，所以这里去重。
 */
export function buildValidateError(
  errorFields: ErrorField[],
  values: Recordable,
): FormValidateError {
  return {
    errorFields: errorFields.map(({ errors, name }) => ({
      errors,
      name: [name],
    })),
    message: errorFields[0]?.errors[0],
    outOfDate: false,
    values,
  };
}

/** 从 TanStack 的字段 meta 里取去重后的错误文案 */
export function readErrorMessages(errors: unknown): string[] {
  return [...new Set(((errors ?? []) as unknown[]).map(String))];
}
