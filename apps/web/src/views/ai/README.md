# AI 配置菜单：接线现状与扩展点说明

> 对齐 `AI集成度现状评估与缺口分析.md`（"引擎完备，接线为零"）。本目录说明**本仓库真实落地了什么**、**哪些仍需要外部依赖**，以及每个缺口该"接哪里、改哪个文件"。诚实口径：这里**没有**引入任何真实大模型 SDK、向量库或第三方服务，也没有联网。所谓"真实功能化"是指把 demo 页改成**真实配置管理 + SQLite 持久化 + 可替换的接入扩展点**。

## 一、已落地（配置管理 / 持久化 / 接入适配点 / 状态流转）

| 能力 | 落地形态 | 关键文件 |
| --- | --- | --- |
| 供应商配置管理 | 列表/筛选/分页/增删改，`key` 入参在服务端立即脱敏，只存末 4 位掩码与状态 | `apps/web/backend-mock/server/utils/db/ai.ts`、`server/api/ai/provider/**`、本目录 `provider/index.vue` |
| 模型配置管理 | 校验 `providerId` 必须存在，`providerName` 由 db 关联回填；支持按供应商筛选 | `server/api/ai/model/**`、本目录 `model-list/index.vue` |
| 知识库配置管理 | 文档数/分片数/向量数/可见范围/启停的元数据 CRUD | `server/api/ai/knowledge/**`、本目录 `knowledge/index.vue` |
| 编排应用元数据 | 流程定义（名称/节点数/版本/草稿→发布）CRUD，不碰引擎内核 | `server/api/ai/flow/**` |
| 总览统计 | 四页共用 `/ai/overview`，stats 不再硬编码 | `server/api/ai/overview.get.ts` |
| Agent 配置管理 | Agent 自身字段（名称 / 职责 / 负责人 / 状态 / 标签）独立 CRUD，不混入模型与知识库数据 | `server/api/ai/agent/**`、`../enterprise/ai/index.vue` |
| Chat 接线点 | 全局右下角 AI 助手，可选 `modelId` 入参；回复末尾带"当前选用模型/知识库"来源标注；`{ content }` 契约不变 | `server/api/ai/chat.post.ts`、`apps/web/src/api/ai-chat.ts`、`apps/web/src/components/ai-assistant/index.vue` |
| 引擎接线文档 | 编排页已注明 `configureAiFlow()` / `createFetchAiProvider()` 两个接线点，未改动引擎源码 | `../enterprise/ai-flow/index.vue` |

数据层用 `defineCollection<T>` + 固定表名（`tb_ai_agent` / `tb_ai_provider` / `tb_ai_model` / `tb_ai_knowledge` / `tb_ai_flow`），零随机种子，重启仍在。模型列表页的「配置供应商」可直接新建 / 编辑 / 删除供应商，保存后下拉选项即时刷新。列表统一 `paginateList` 服务端切页，响应恒 HTTP 200、成败看 `code`。

## 二、未落地（需要外部依赖，仓库当前不具备）

| 缺口 | 优先级 | 为什么没做 | 接哪里 |
| --- | --- | --- | --- |
| 真实模型 SDK / 网关转发 | P0 | 项目无任何模型 SDK 依赖，后端是 backend-mock，无外部 key | `server/api/ai/chat.post.ts` 顶部注释标出的唯一替换点：`buildReply(...)` → `provider.invoke(...)`。凭据放服务端 fetcher，前端零接触 |
| RAG / 向量检索 | P0 | 无 embedding、无向量库，`memory.ts` 明确不做向量召回 | 新增服务端检索适配器，`knowledge` 页当前只管元数据；`chat.post.ts` 的 `resolveSourceNotes()` 是检索结果注入的挂接点 |
| 密钥托管服务 | P0 | 当前只存掩码，没有真实 KMS | 新增服务端密钥仓库；`db/ai.ts` 的 `maskApiKey()` 已是写入前的脱敏边界，真实密钥应替换这一层的入参来源 |
| 租户 / 配额 / 计费 / 审计 / PII | P0 | 需要持久化与权限体系打通，超出 mock 边界 | 在 `db/ai.ts` 增加租户维度与审计表，列表 handler 注入租户过滤；与现有 `v-permission` 对接 |
| trace/span + token 成本看板 | P1 | 引擎已有 `AiFlowEvent` 与 usage，但无落库/报表 | 消费 `AiFlowEvent` 写审计/成本表，新增报表接口 |
| prompt 管理 / 数据集 / 评测 / 版本化 | P1 | 编排画布已能画图，但无生产闭环 | 复用 `flow` 元数据集合扩展字段，新增 prompt/eval 集合 |
| 模型网关部署 / 灰度 / 监控 | P1 | 纯部署运维，与前端无关 | CI/CD 与网关层，不在本仓库 mock 范围 |

## 三、接线指引（按缺口）

1. **接真实模型（阶段一）**
   - 服务端：`chat.post.ts` 把 `buildReply()` 换成 `createFetchAiProvider({ baseUrl, fetcher }).invoke(...)`，`fetcher` 在服务端构造并携带托管凭据；保留 `{ content }` 返回结构。
   - 前端：`api/ai-chat.ts` 的 `chatWithAi()` 是唯一传输出口；若改走 SSE，用 `@antdv/common-ui/ai-flow` 的 `useSSE`，Chat 组件不用改。
   - 编排页：`../enterprise/ai-flow/index.vue` 把 `createScriptedProvider` 换成 `createFetchAiProvider`，图与运行器代码不动。

2. **接 RAG（阶段二）**
   - `knowledge` 页新增"上传/切分/重建索引"动作 → 新增服务端知识库适配器接口。
   - `chat.post.ts` 的 `resolveSourceNotes()` 从"读配置元数据"替换为"调用检索适配器"，把命中片段拼进 prompt 与来源标注。

3. **接企业管控（阶段三）**
   - `db/ai.ts` 五集合增加 `tenantId`，各 list handler 加租户过滤；`keyStatus` 已预留轮换状态流转。
   - `overview.get.ts` 扩展成本/配额指标；审计表单独建表，不复用业务表。

## 四、安全口径

- 明文 API Key **绝不落库、绝不回包**：`saveProvider()` 只接收 `key` 用于生成 `keyMasked`，存储与接口响应都只有脱敏串和 `keyStatus`。
- 前端零接触密钥：供应商页的 key 列只读展示 `keyMasked`；表单里的 key 输入框只是"写入入口"，服务端立即脱敏。
- `ai-flow` 引擎内核（`core/**`）未作任何修改；它本来就不读 env、不碰密钥。

## 五、验证

```bash
cd apps/web
pnpm test:server --testPathPattern ai-config.test.ts
```
