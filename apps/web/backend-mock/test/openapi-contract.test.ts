import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CODE_CATALOG } from '../server/contracts/codes';
import { PermissionCode } from '../server/contracts/permissions';
import {
  CODES,
  ENDPOINTS,
  INFO,
  PERMISSIONS,
  SCHEMAS,
} from '../scripts/openapi-contracts.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const spec = JSON.parse(
  readFileSync(join(ROOT, 'docs/openapi.json'), 'utf8'),
) as {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, { responses: Record<string, unknown>; 'x-permission'?: string }>>;
  components: { schemas: Record<string, unknown> };
};

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : [];
  });
}

/** 与生成器保持同一套文件约定，防止新增路由忘记重新生成文档 */
function routeKeyOf(file: string): string | null {
  const rel = file.slice(join(ROOT, 'server/api').length + 1).replaceAll('\\', '/');
  const match = /\.(get|post|put|delete|patch)\.ts$/.exec(rel);
  if (!match) return null;
  const segments = rel
    .slice(0, -match[0].length)
    .split('/')
    .filter((part) => part && part !== 'index')
    .map((part) =>
      part.startsWith('[') && part.endsWith(']') ? `{${part.slice(1, -1)}}` : part,
    );
  return `${match[1]!.toUpperCase()} /${segments.join('/')}`;
}

describe('OpenAPI 规范与代码契约对账', () => {
  it('规范基础信息与生成物完整', () => {
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe(INFO.title);
    expect(spec.info.version).toBe(INFO.version);
    expect(Object.keys(spec.components.schemas).length).toBeGreaterThan(10);
    for (const name of Object.keys(SCHEMAS)) {
      expect(spec.components.schemas[name], `缺少 schema ${name}`).toBeDefined();
    }
  });

  it('覆盖 server/api 下全部路由，且每个操作都有标准响应', () => {
    const files = walk(join(ROOT, 'server/api'));
    const keys = files.map(routeKeyOf).filter((key): key is string => Boolean(key));
    const specKeys = Object.entries(spec.paths).flatMap(([path, methods]) =>
      Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
    );
    expect(specKeys.length).toBe(keys.length);
    expect(new Set(specKeys)).toEqual(new Set(keys));
    for (const methods of Object.values(spec.paths)) {
      for (const operation of Object.values(methods)) {
        expect(operation.responses['200']).toBeDefined();
        expect(Object.keys(operation.responses)).toContain('400');
      }
    }
  });

  it('注册表里的增强端点都真实存在', () => {
    for (const key of Object.keys(ENDPOINTS)) {
      const [method, ...rest] = key.split(' ');
      const path = rest.join(' ');
      expect(spec.paths[path]?.[method!.toLowerCase()], `增强端点不存在：${key}`).toBeDefined();
    }
  });

  it('码表与权限码和 TypeScript 真值源一致', () => {
    const fromTs = CODE_CATALOG.map((item) => [item.code, item.message, item.success]);
    const fromRegistry = CODES.map(([code, message, , success]) => [code, message, success]);
    expect(fromRegistry).toEqual(fromTs);

    const tsPermissions = Object.values(PermissionCode).filter((code) => code !== '*');
    expect(PERMISSIONS.map(([code]) => code)).toEqual(tsPermissions);
    for (const operation of Object.values(spec.paths).flatMap((methods) =>
      Object.values(methods),
    )) {
      if (operation['x-permission']) {
        expect(PERMISSIONS.map(([code]) => code)).toContain(operation['x-permission']);
      }
    }
  });
});

describe('接口接入文档', () => {
  const markdown = readFileSync(join(ROOT, 'docs/API_CONTRACT.md'), 'utf8');

  it('包含生产接入必备章节', () => {
    for (const section of [
      '统一响应格式',
      '状态码体系',
      '标准错误结构',
      '分页约定',
      '参数校验',
      '权限标识',
      '操作日志与审计',
      '迁移为真实后端',
    ]) {
      expect(markdown, `文档缺少章节：${section}`).toContain(section);
    }
  });

  it('列出全部接口路径', () => {
    for (const path of Object.keys(spec.paths)) {
      expect(markdown).toContain(`/api${path}`);
    }
  });
});
