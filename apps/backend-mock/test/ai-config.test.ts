import type { TestEvent } from './fixtures/nitro-imports';

import { beforeEach, describe, expect, it } from 'vitest';

import agentDeleteRoute from '../server/api/ai/agent/[id].delete';
import agentListRoute from '../server/api/ai/agent/list.get';
import agentSaveRoute from '../server/api/ai/agent/save.post';
import chatRoute from '../server/api/ai/chat.post';
import flowDeleteRoute from '../server/api/ai/flow/[id].delete';
import flowListRoute from '../server/api/ai/flow/list.get';
import flowSaveRoute from '../server/api/ai/flow/save.post';
import knowledgeDeleteRoute from '../server/api/ai/knowledge/[id].delete';
import knowledgeListRoute from '../server/api/ai/knowledge/list.get';
import knowledgeSaveRoute from '../server/api/ai/knowledge/save.post';
import modelDeleteRoute from '../server/api/ai/model/[id].delete';
import modelListRoute from '../server/api/ai/model/list.get';
import modelSaveRoute from '../server/api/ai/model/save.post';
import overviewRoute from '../server/api/ai/overview.get';
import providerDeleteRoute from '../server/api/ai/provider/[id].delete';
import providerListRoute from '../server/api/ai/provider/list.get';
import providerSaveRoute from '../server/api/ai/provider/save.post';
import {
  AI_AGENT_DB,
  AI_FLOW_DB,
  AI_KNOWLEDGE_DB,
  AI_MODEL_DB,
  AI_PROVIDER_DB,
  listModelsWithProvider,
  maskApiKey,
  summarizeAiOverview,
} from '../server/utils/db/ai';
import { createTestEvent } from './fixtures/nitro-imports';

type Handler = (event: TestEvent) => Promise<{
  code: number;
  data: any;
  message: string;
}>;
const as = (route: unknown) => route as Handler;

const agentList = as(agentListRoute);
const agentSave = as(agentSaveRoute);
const agentDelete = as(agentDeleteRoute);
const providerList = as(providerListRoute);
const providerSave = as(providerSaveRoute);
const providerDelete = as(providerDeleteRoute);
const modelList = as(modelListRoute);
const modelSave = as(modelSaveRoute);
const modelDelete = as(modelDeleteRoute);
const knowledgeList = as(knowledgeListRoute);
const knowledgeSave = as(knowledgeSaveRoute);
const knowledgeDelete = as(knowledgeDeleteRoute);
const flowList = as(flowListRoute);
const flowSave = as(flowSaveRoute);
const flowDelete = as(flowDeleteRoute);
const overview = as(overviewRoute);
const chat = as(chatRoute);

/** 模块加载时抓种子快照：用例会加删行，每条用例前完整还原 */
const seedAgents = [...AI_AGENT_DB].map((row) => ({
  ...row,
  tags: [...row.tags],
}));
const seedProviders = [...AI_PROVIDER_DB].map((row) => ({ ...row }));
const seedModels = [...AI_MODEL_DB].map((row) => ({ ...row }));
const seedKnowledge = [...AI_KNOWLEDGE_DB].map((row) => ({ ...row }));
const seedFlows = [...AI_FLOW_DB].map((row) => ({ ...row }));

function restore<T extends { id: number }>(db: T[], seeds: T[]): void {
  const seedIds = new Set(seeds.map((row) => row.id));
  [...db.keys()]
    .filter((key) => !seedIds.has(db[key]!.id))
    .reverse()
    .forEach((key) => db.splice(key, 1));
  seeds.forEach((seed, index) => {
    db[index] = { ...seed };
  });
}

describe('aI 配置数据闭环', () => {
  beforeEach(() => {
    restore(AI_AGENT_DB, seedAgents);
    restore(AI_PROVIDER_DB, seedProviders);
    restore(AI_MODEL_DB, seedModels);
    restore(AI_KNOWLEDGE_DB, seedKnowledge);
    restore(AI_FLOW_DB, seedFlows);
  });

  it('四集合种子彼此关联：模型 providerId 指向存在的供应商，providerName 可关联回填', () => {
    expect(seedProviders).toHaveLength(6);
    expect(seedModels).toHaveLength(6);
    expect(seedKnowledge).toHaveLength(5);
    expect(seedFlows).toHaveLength(4);

    for (const model of AI_MODEL_DB) {
      const provider = seedProviders.find(
        (item) => item.id === model.providerId,
      );
      expect(provider).toBeDefined();
      expect(model.providerName).toBe(provider!.name);
    }
    const joined = listModelsWithProvider();
    expect(joined).toHaveLength(6);
    expect(joined.every((row) => row.providerName.length > 0)).toBe(true);
  });

  it('maskApiKey 幂等且只保留末 4 位', () => {
    expect(maskApiKey('sk-abcdefgh1234')).toBe('sk-****1234');
    expect(maskApiKey('sk-****1234')).toBe('sk-****1234');
    expect(maskApiKey('')).toBe('');
    expect(maskApiKey('—')).toBe('');
  });

  it('供应商：明文 key 被脱敏落库，分页 / 筛选 / CRUD 均可用', async () => {
    const created = await providerSave(
      createTestEvent({
        body: {
          name: '测试网关',
          endpoint: 'test.local/v1',
          protocol: 'openai-compatible',
          key: 'sk-abcdefgh9876',
        },
      }),
    );
    expect(created.code).toBe(200);
    expect(created.data.keyMasked).toBe('sk-****9876');
    expect(created.data.keyStatus).toBe('configured');
    const stored = AI_PROVIDER_DB.find((row) => row.id === created.data.id)!;
    expect(stored.keyMasked).toBe('sk-****9876');
    // 明文 key 既不落库也不回包
    expect(stored).not.toHaveProperty('key');
    expect(created.data).not.toHaveProperty('key');

    const page1 = (
      await providerList(
        createTestEvent({ query: { pageNum: '1', pageSize: '2' } }),
      )
    ).data;
    expect(page1.list).toHaveLength(2);
    expect(page1.total).toBe(7);
    const all = (await providerList(createTestEvent())).data;
    expect(all.list).toHaveLength(7);

    const disabled = (
      await providerList(createTestEvent({ query: { status: 'disabled' } }))
    ).data;
    expect(disabled.total).toBe(1);
    expect(disabled.list[0].name).toBe('自建推理服务');
    const keyword = (
      await providerList(createTestEvent({ query: { keyword: 'deepseek' } }))
    ).data;
    expect(keyword.total).toBe(1);
    expect(keyword.list[0].code).toBe('V-02');

    // 只回传 id + keyStatus 即可标记轮换，脱敏串保留
    const rotated = await providerSave(
      createTestEvent({ body: { id: created.data.id, keyStatus: 'rotate' } }),
    );
    expect(rotated.code).toBe(200);
    expect(
      AI_PROVIDER_DB.find((row) => row.id === created.data.id),
    ).toMatchObject({
      keyMasked: 'sk-****9876',
      keyStatus: 'rotate',
    });

    expect(
      (
        await providerDelete(
          createTestEvent({ params: { id: String(created.data.id) } }),
        )
      ).code,
    ).toBe(200);
    expect(
      AI_PROVIDER_DB.find((row) => row.id === created.data.id),
    ).toBeUndefined();
    expect(
      (
        await providerDelete(
          createTestEvent({ params: { id: String(created.data.id) } }),
        )
      ).code,
    ).toBe(404);
  });

  it('供应商：必填校验与不存在的 id', async () => {
    expect(
      (await providerSave(createTestEvent({ body: { endpoint: 'x' } }))).code,
    ).toBe(400);
    expect(
      (await providerSave(createTestEvent({ body: { name: 'X' } }))).code,
    ).toBe(400);
    expect(
      (
        await providerSave(
          createTestEvent({ body: { id: 999_999, name: 'X' } }),
        )
      ).code,
    ).toBe(404);
    expect(
      (await providerDelete(createTestEvent({ params: { id: '999999' } })))
        .code,
    ).toBe(404);
  });

  it('模型：providerId 不存在被拒，providerName 由关联回填，分页 / 筛选 / CRUD 可用', async () => {
    const badLink = await modelSave(
      createTestEvent({
        body: { name: 'bad', code: 'bad', providerId: 999_999 },
      }),
    );
    expect(badLink.code).toBe(400);
    expect(badLink.message).toContain('供应商');

    const created = await modelSave(
      createTestEvent({
        body: {
          name: 'test-model',
          code: 'test-model',
          providerId: 2,
          context: '32K',
        },
      }),
    );
    expect(created.code).toBe(200);
    expect(created.data.providerName).toBe('DeepSeek');
    expect(
      AI_MODEL_DB.find((row) => row.id === created.data.id)!.providerName,
    ).toBe('DeepSeek');

    const byProvider = (
      await modelList(createTestEvent({ query: { providerId: '2' } }))
    ).data;
    expect(byProvider.total).toBe(2);
    expect(byProvider.list.every((row: any) => row.providerId === 2)).toBe(
      true,
    );
    const online = (
      await modelList(createTestEvent({ query: { status: 'online' } }))
    ).data;
    // 4 条种子在线 + 本用例刚建的 1 条（默认 online）
    expect(online.total).toBe(5);
    const page2 = (
      await modelList(
        createTestEvent({ query: { pageNum: '2', pageSize: '4' } }),
      )
    ).data;
    expect(page2.list).toHaveLength(3);
    expect(page2.total).toBe(7);

    expect(
      (await modelSave(createTestEvent({ body: { id: 999_999, name: 'X' } })))
        .code,
    ).toBe(404);
    expect(
      (
        await modelDelete(
          createTestEvent({ params: { id: String(created.data.id) } }),
        )
      ).code,
    ).toBe(200);
    expect(
      AI_MODEL_DB.find((row) => row.id === created.data.id),
    ).toBeUndefined();
  });

  it('知识库与编排：分页 / 筛选 / 校验 / CRUD 均可用', async () => {
    // 名称必填；scope 缺省回落到「全员」
    expect(
      (await knowledgeSave(createTestEvent({ body: { scope: '全员' } }))).code,
    ).toBe(400);
    const createdKnowledge = await knowledgeSave(
      createTestEvent({
        body: { name: '测试知识库', scope: '全员', docs: 10, vectors: 4 },
      }),
    );
    expect(createdKnowledge.code).toBe(200);
    expect(createdKnowledge.data.code).toBe('K-06');
    const kPage = (
      await knowledgeList(
        createTestEvent({ query: { pageNum: '1', pageSize: '2' } }),
      )
    ).data;
    expect(kPage.list).toHaveLength(2);
    expect(kPage.total).toBe(6);
    const kKeyword = (
      await knowledgeList(createTestEvent({ query: { keyword: '研发规范' } }))
    ).data;
    expect(kKeyword.total).toBe(1);
    expect(
      (
        await knowledgeDelete(
          createTestEvent({ params: { id: String(createdKnowledge.data.id) } }),
        )
      ).code,
    ).toBe(200);

    expect(
      (await flowSave(createTestEvent({ body: { description: '无名称' } })))
        .code,
    ).toBe(400);
    const createdFlow = await flowSave(
      createTestEvent({ body: { name: '测试编排', nodeCount: 3 } }),
    );
    expect(createdFlow.code).toBe(200);
    expect(createdFlow.data.status).toBe('draft');
    const published = await flowSave(
      createTestEvent({
        body: { id: createdFlow.data.id, status: 'published' },
      }),
    );
    expect(published.code).toBe(200);
    const fList = (
      await flowList(createTestEvent({ query: { status: 'published' } }))
    ).data;
    expect(fList.total).toBe(3);
    const fPage = (
      await flowList(
        createTestEvent({ query: { pageNum: '2', pageSize: '2' } }),
      )
    ).data;
    expect(fPage.list).toHaveLength(2);
    expect(fPage.total).toBe(5);
    expect(
      (
        await flowDelete(
          createTestEvent({ params: { id: String(createdFlow.data.id) } }),
        )
      ).code,
    ).toBe(200);
  });

  it('chat：不带参数完全兼容，带 modelId / knowledgeId 时带来源标注', async () => {
    const messages = [{ content: '你好', role: 'user' }];

    const plain = await chat(createTestEvent({ body: { messages } }));
    expect(plain.code).toBe(200);
    expect(typeof plain.data.content).toBe('string');
    expect(plain.data.content).not.toContain('[来源]');

    const withSources = await chat(
      createTestEvent({ body: { messages, modelId: 3, knowledgeId: 1 } }),
    );
    expect(withSources.code).toBe(200);
    expect(withSources.data.content).toContain('[来源]');
    expect(withSources.data.content).toContain('deepseek-v3');
    expect(withSources.data.content).toContain('DeepSeek');
    expect(withSources.data.content).toContain('产品手册');

    // 不存在的 id / 非在线模型 / 停用知识库都不产生标注
    const invalidModel = await chat(
      createTestEvent({ body: { messages, modelId: 999_999 } }),
    );
    expect(invalidModel.data.content).not.toContain('[来源]');
    const offlineModel = await chat(
      createTestEvent({ body: { messages, modelId: 5 } }),
    );
    expect(offlineModel.data.content).not.toContain('[来源]');
    const disabledKnowledge = await chat(
      createTestEvent({ body: { messages, knowledgeId: 5 } }),
    );
    expect(disabledKnowledge.data.content).not.toContain('[来源]');
  });

  it('overview 统计与五集合实时汇总一致', async () => {
    const expected = {
      agentDraft: 2,
      agentRunning: 2,
      agentTotal: 5,
      flowDraft: 2,
      flowNodeCount: 22,
      flowPublished: 2,
      flowTotal: 4,
      keyMissing: 1,
      keyRotate: 2,
      knowledgeDocs: 1286,
      knowledgePending: 64,
      knowledgeTotal: 5,
      knowledgeVectors: 1222,
      modelCallsToday: 26_370,
      modelError: 1,
      modelOnline: 4,
      modelTotal: 6,
      providerEnabled: 5,
      providerTotal: 6,
    };
    expect(summarizeAiOverview()).toEqual(expected);
    const res = await overview(createTestEvent());
    expect(res.code).toBe(200);
    expect(res.data).toEqual(expected);
  });

  it('agent 独立 CRUD：只写 Agent 表，字段不混入模型 / 知识库', async () => {
    const knowledgeBefore = AI_KNOWLEDGE_DB.length;
    const modelBefore = AI_MODEL_DB.length;

    const created = await agentSave(
      createTestEvent({
        body: {
          description: '只做 Agent 自身的配置',
          name: '测试 Agent',
          owner: '测试组',
          status: 'draft',
          tags: ['测试', '专用'],
        },
      }),
    );
    expect(created.code, created.message).toBe(200);
    const agent = created.data;
    expect(agent.code).toBe('AG-06');
    expect(agent.tags).toEqual(['测试', '专用']);
    expect(agent).not.toHaveProperty('providerId');
    expect(agent).not.toHaveProperty('vectorModel');

    const listed = await agentList(
      createTestEvent({ query: { keyword: '测试 Agent', status: 'draft' } }),
    );
    expect(listed.code).toBe(200);
    expect(listed.data.list.map((row: any) => row.id)).toContain(agent.id);

    const updated = await agentSave(
      createTestEvent({
        body: {
          id: agent.id,
          name: '测试 Agent（已改）',
          status: 'running',
          tags: '单个,标签',
        },
      }),
    );
    expect(updated.code).toBe(200);
    expect(updated.data.tags).toEqual(['单个', '标签']);
    expect(updated.data.status).toBe('running');

    const removed = await agentDelete(
      createTestEvent({ params: { id: String(agent.id) } }),
    );
    expect(removed.code).toBe(200);
    expect(AI_AGENT_DB.some((row) => row.id === agent.id)).toBe(false);
    expect(AI_KNOWLEDGE_DB).toHaveLength(knowledgeBefore);
    expect(AI_MODEL_DB).toHaveLength(modelBefore);
  });

  it('agent 标签把 VNode / JSON 串洗成纯文本，列表出参也不回吐对象', async () => {
    const dirty = JSON.stringify([
      { __v_isVNode: true, children: '报表' },
      { __v_isVNode: true, children: '推送' },
    ]);
    const created = await agentSave(
      createTestEvent({
        body: {
          description: '标签脏数据回归',
          name: '标签清洗 Agent',
          owner: '测试组',
          status: 'draft',
          tags: dirty,
        },
      }),
    );
    expect(created.code, created.message).toBe(200);
    expect(created.data.tags).toEqual(['报表', '推送']);

    // 旧库行不回写，只在出参时兜底清洗
    const row = AI_AGENT_DB.find((item) => item.id === created.data.id)!;
    row.tags = [dirty] as any;
    const listed = await agentList(createTestEvent({ query: {} }));
    const listedRow = listed.data.list.find(
      (item: any) => item.id === created.data.id,
    );
    expect(listedRow.tags).toEqual(['报表、推送']);
  });
});
