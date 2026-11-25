/**
 * 自定义接口定义的校验（生成式响应能力已下线）。
 *
 * 保留校验与回显是为了兼容既有接口路径与返回结构；定义不再注册成运行时路由，
 * 不再渲染模板，也不会返回生成的假响应。file 字段按既有命名规则生成，仅作展示。
 */

import type {
  GeneratedRouteDefinition,
  GeneratedRouteFile,
} from '@antdv/types';

import { generatedFileOf } from './route-meta';
import { findGenerated, getStore } from './store';
import { parseTemplate } from './templates';

const ID_RE = /^[a-z][a-z0-9-]{1,63}$/;
const KEY_RE = /^\[(GET|POST|PUT|PATCH|DELETE)\]\/[A-Za-z0-9\-/:._]+$/;

/** 接口标识规则：与 legacy 相同，删除接口时也用它挡掉非法 id */
export function isGeneratedId(id: string): boolean {
  return ID_RE.test(id);
}

/** 校验请求体并补默认值；错误文案与 legacy 保持逐字一致 */
export function validateDefinition(body: Record<string, unknown>): {
  error?: string;
  value?: GeneratedRouteDefinition;
} {
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const key = typeof body.key === 'string' ? body.key.trim() : '';
  if (!ID_RE.test(id))
    return {
      error:
        '接口标识需为小写字母开头的短横线命名（2-64 位），且不能含特殊字符',
    };
  if (!KEY_RE.test(key))
    return {
      error:
        '请求地址需形如 [GET]/demo/statistics，支持 GET / POST / PUT / PATCH / DELETE',
    };

  const parsed = parseTemplate(body.template);
  if (parsed.error) return { error: parsed.error };

  const existing = findGenerated(id);
  const duplicated = getStore().manifest[key];
  if (duplicated && (!existing || existing.key !== key))
    return {
      error: `该 method + path 已被接口「${key}」占用，请换个地址或改为编辑原接口`,
    };

  return {
    value: {
      id,
      key,
      message:
        typeof body.message === 'string' && body.message.trim()
          ? body.message.trim()
          : '获取数据成功',
      template: parsed.template!,
      title:
        typeof body.title === 'string' && body.title.trim()
          ? body.title.trim()
          : id,
    },
  };
}

/** 仅回显校验后的定义；不再登记生成式路由（能力已下线） */
export function saveGeneratedDefinition(
  definition: GeneratedRouteDefinition,
): GeneratedRouteFile {
  return { ...definition, file: generatedFileOf(definition.id) };
}
