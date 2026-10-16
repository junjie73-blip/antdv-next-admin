import type {
  FormSchema,
  Recordable,
  Rule,
} from './components/form-render/schema';

import { getDynamicRules } from './components/form-render/helper';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

export function isEmptyValue(value: any): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function typeMatches(type: string | undefined, value: any): boolean {
  switch (type) {
    case 'array': {
      return Array.isArray(value);
    }
    case 'boolean': {
      return typeof value === 'boolean';
    }
    case 'email': {
      return typeof value === 'string' && EMAIL_RE.test(value);
    }
    case 'float':
    case 'integer':
    case 'number': {
      const num = Number(value);
      if (Number.isNaN(num)) return false;
      return type === 'integer' ? Number.isInteger(num) : true;
    }
    case 'object': {
      return (
        typeof value === 'object' && value !== null && !Array.isArray(value)
      );
    }
    case 'regexp': {
      try {
        new RegExp(String(value));
        return true;
      } catch {
        return false;
      }
    }
    case 'string': {
      return typeof value === 'string';
    }
    case 'url': {
      return typeof value === 'string' && URL_RE.test(value);
    }
    default: {
      return true;
    }
  }
}

function lengthOf(value: any): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  return String(value ?? '').length;
}

/**
 * 执行单条规则，返回错误消息（无错误返回 undefined）。
 * 语义对齐旧 antdv async-validator 的常用子集。
 */
export async function runRule(
  rule: Rule,
  rawValue: any,
  opts: { joinLabel?: boolean; label: string },
): Promise<string | undefined> {
  const { joinLabel, label } = opts;
  const value = rule.transform ? rule.transform(rawValue) : rawValue;

  if (
    rule.required &&
    (isEmptyValue(value) ||
      (rule.whitespace && typeof value === 'string' && value.trim() === ''))
  ) {
    return rule.message || (joinLabel ? `${label}不能为空` : '该项为必填项');
  }

  // 自定义 validator 先跑：antd 的 async-validator 对空值一样会执行它，
  // 页面里「必须选中某个值」「两次输入要一致」这类规则全靠这条路径拦下来。
  if (typeof rule.validator === 'function') {
    try {
      let callbackError: any;
      const ret = rule.validator(rule, value, (err?: any) => {
        callbackError = err;
      });
      if (ret && typeof ret.then === 'function') {
        await ret;
      }
      if (callbackError) {
        return String(
          callbackError?.message ?? callbackError ?? rule.message ?? '校验失败',
        );
      }
    } catch (error: any) {
      return String(error?.message ?? error ?? rule.message ?? '校验失败');
    }
  }

  // 非必填且为空 → 跳过内置规则（antdv 语义），上面的 validator 不受这条影响
  if (isEmptyValue(value)) return undefined;

  if (rule.type && !typeMatches(rule.type, value)) {
    return rule.message || `${label}类型不正确`;
  }

  if (rule.pattern !== undefined) {
    const re =
      rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern);
    if (!re.test(String(value))) {
      return rule.message || `${label}格式不正确`;
    }
  }

  const len = lengthOf(value);
  if (rule.len !== undefined && len !== rule.len) {
    return rule.message || `长度必须为 ${rule.len}`;
  }
  if (rule.min !== undefined) {
    if (typeof value === 'number' && value < rule.min) {
      return rule.message || `不得小于 ${rule.min}`;
    }
    if ((typeof value === 'string' || Array.isArray(value)) && len < rule.min) {
      return rule.message || `不得少于 ${rule.min} 个字符`;
    }
  }
  if (rule.max !== undefined) {
    if (typeof value === 'number' && value > rule.max) {
      return rule.message || `不得大于 ${rule.max}`;
    }
    if ((typeof value === 'string' || Array.isArray(value)) && len > rule.max) {
      return rule.message || `不得多于 ${rule.max} 个字符`;
    }
  }

  return undefined;
}

/**
 * 把 schema 的规则编译成 @tanstack/vue-form 字段校验函数。
 * 每次执行都通过 getDynamicRules 取最新规则（支持 dynamicRules 依赖其它字段）。
 */
export function compileFieldValidator(
  schema: FormSchema,
  getValues: () => Recordable,
  formActionType?: any,
): (ctx: { value: any }) => Promise<string | undefined> {
  return async ({ value }) => {
    const values = getValues();
    const rules = getDynamicRules(schema, values, formActionType) ?? [];
    const joinLabel =
      schema.rulesMessageJoinLabel ??
      (values as Recordable).__rulesMessageJoinLabel ??
      false;
    const label = schema.label || schema.field;

    for (const rule of rules) {
      const error = await runRule(rule, value, { joinLabel, label });
      if (error) return error;
    }
    return undefined;
  };
}
