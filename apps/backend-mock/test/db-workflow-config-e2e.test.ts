/**
 * workflow / config 域端到端持久化测试（SQLITE_MIGRATION_PLAN.md §4.7 P2 收尾）。
 *
 * WORKFLOW_STORE 与 CONFIG_VALUES 原先是进程内可变对象，重启即丢：
 * - 工作流改为 defineCollection(tb_workflow)
 * - 系统配置改为 defineKVMap(tb_config)
 * 这里直接调用真实 handler，验证 save / status / delete / config save / reset
 * 在 MOCK_STORE=sqlite 下落库，且「模拟重启」（清单例 + 重载模块）后数据仍在。
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeDb } from '../server/utils/db/sqlite/connection';
import { resetStoreForTest } from '../server/utils/db/sqlite';
import { createTestEvent } from './fixtures/nitro-imports';

import type { TestEvent } from './fixtures/nitro-imports';

interface Envelope<T> {
  code: number;
  data: T;
  message: string;
}

type RouteHandler = (event: TestEvent) => Promise<unknown>;

let workDir: string;
let handlers: {
  workflowList: RouteHandler;
  workflowSave: RouteHandler;
  workflowDelete: RouteHandler;
  configList: RouteHandler;
  configSave: RouteHandler;
  configReset: RouteHandler;
};

async function loadFresh(): Promise<void> {
  closeDb();
  resetStoreForTest();
  vi.resetModules();
  const [list, save, remove, cfgList, cfgSave, cfgReset] = await Promise.all([
    import('../server/api/enterprise/workflow/list.get'),
    import('../server/api/enterprise/workflow/save.post'),
    import('../server/api/enterprise/workflow/[id].delete'),
    import('../server/api/system/config/list.get'),
    import('../server/api/system/config/save.put'),
    import('../server/api/system/config/reset.put'),
  ]);
  handlers = {
    workflowList: list.default as RouteHandler,
    workflowSave: save.default as RouteHandler,
    workflowDelete: remove.default as RouteHandler,
    configList: cfgList.default as RouteHandler,
    configSave: cfgSave.default as RouteHandler,
    configReset: cfgReset.default as RouteHandler,
  };
}

function event(init: {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
}): TestEvent {
  return createTestEvent(init);
}

interface WorkflowListData {
  list: Array<{ id: string; name: string; status: string }>;
  total: number;
}

interface ConfigListData {
  panels: unknown[];
  values: Record<string, Record<string, boolean | number | string>>;
}

async function getWorkflows(): Promise<Envelope<WorkflowListData>> {
  // workflow list 默认 pageSize=10，显式放大以取全量做持久化断言
  return (await handlers.workflowList(
    event({ query: { pageSize: '100' } }),
  )) as Envelope<WorkflowListData>;
}

async function getConfig(): Promise<Envelope<ConfigListData>> {
  return (await handlers.configList(event({}))) as Envelope<ConfigListData>;
}

beforeEach(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'antdv-mock-wf-'));
  process.env.MOCK_STORE = 'sqlite';
  process.env.MOCK_DB_FILE = join(workDir, 'mock.sqlite');
  await loadFresh();
});

afterEach(() => {
  closeDb();
  resetStoreForTest();
  delete process.env.MOCK_STORE;
  delete process.env.MOCK_DB_FILE;
  if (existsSync(workDir)) rmSync(workDir, { force: true, recursive: true });
});

describe('workflow 域 · 信封不变 + 重启持久化', () => {
  it('列表返回 code=200 与稳定种子总量', async () => {
    const res = await getWorkflows();
    expect(res.code).toBe(200);
    expect(res.data.total).toBeGreaterThan(0);
    expect(res.data.list.length).toBe(res.data.total);
  });

  it('新建流程后重启仍在', async () => {
    const before = (await getWorkflows()).data.total;
    const created = (await handlers.workflowSave(
      event({ body: { name: '持久化验收流程', category: '测试' } }),
    )) as Envelope<{ id: string; name: string }>;
    expect(created.code).toBe(200);
    expect(created.data.name).toBe('持久化验收流程');

    await loadFresh(); // 模拟进程重启
    const after = await getWorkflows();
    expect(after.data.total).toBe(before + 1);
    expect(after.data.list.some((i) => i.name === '持久化验收流程')).toBe(true);
  });

  it('删除是软删除：重启后不复活', async () => {
    const target = (await getWorkflows()).data.list[0]!;
    const res = (await handlers.workflowDelete(
      event({ params: { id: target.id } }),
    )) as Envelope<unknown>;
    expect(res.code).toBe(200);

    await loadFresh();
    const after = await getWorkflows();
    expect(after.data.list.some((i) => i.id === target.id)).toBe(false);
  });
});

describe('config 域 · 信封不变 + 重启持久化', () => {
  it('list 返回 7 个面板且 values 可完整 JSON 序列化', async () => {
    const res = await getConfig();
    expect(res.code).toBe(200);
    expect(res.data.panels).toHaveLength(7);
    expect(Object.keys(res.data.values)).toHaveLength(7);
    expect(res.data.values.site).toBeDefined();
    // 代理的 ownKeys/getOwnPropertyDescriptor 必须让展开与序列化无损
    expect(JSON.parse(JSON.stringify(res.data.values)).site.siteName).toBeDefined();
  });

  it('保存配置后重启仍在', async () => {
    const saved = (await handlers.configSave(
      event({ body: { panel: 'site', values: { siteName: '重启后仍在' } } }),
    )) as Envelope<{ panel: string; values: Record<string, string> }>;
    expect(saved.code).toBe(200);
    expect(saved.data.values.siteName).toBe('重启后仍在');

    await loadFresh();
    const after = await getConfig();
    expect(after.data.values.site?.siteName).toBe('重启后仍在');
  });

  it('重置面板后重启仍是默认值', async () => {
    await handlers.configSave(
      event({ body: { panel: 'site', values: { siteName: '临时值' } } }),
    );
    const reset = (await handlers.configReset(
      event({ body: { panel: 'site' } }),
    )) as Envelope<{ values: Record<string, string> }>;
    expect(reset.code).toBe(200);

    await loadFresh();
    const after = await getConfig();
    expect(after.data.values.site?.siteName).toBe('Antdv Admin');
  });
});
