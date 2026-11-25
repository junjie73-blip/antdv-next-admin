# AI Native 结构性重构方案

> 目标：把「人找菜单」改造成「AI 指令 + 全局入口 + 上下文感知」的主路径，同时保留菜单作为可回退的安全网。
> 本文是**落地契约**：模块职责、接口签名、迁移顺序与验收标准都按此执行，避免各页面各写一套 AI 接线。

---

## 一、设计原则与模块权重

| 主路径 | 权重 | 定位 | 边界 |
| --- | --- | --- | --- |
| AI 指令（Cmd/Ctrl+K、Copilot） | 主 | 直接下达意图、跳转、筛选、生成表单、智能预填 | 必须给出可撤销结果，危险操作走确认 |
| 全局入口 | 主 | 任意页面一键唤起，携带当前路由与选中行上下文 | 不覆盖页面主内容，轻量化呈现 |
| 上下文感知 | 主 | 让 AI 知道「当前页、当前实体、当前选中行」 | 只读注入，不代替业务鉴权 |
| 左侧菜单 | 兜底 | 总览、发现、权限边界表达；保留全部可达性 | 不再承载动态表格/表单演示入口 |
| 文档站 | 承接 | 组件示例、Schema 规范、扩展指南 | 从主导航移除，链接保留在文档中 |

**三条硬边界**：

1. `packages/ai-tools` 不 import `pinia`、`vue-router`、任何 `@antdv/*` UI 包；它只认接口，不认框架实例。
2. AI **不能绕过后端鉴权**：工具产出的筛选/跳转/写操作仍走原有 API 与路由守卫，AI 只是「代填参数」。
3. 所有写操作（重启流程、提交表单、批量修改）必须经过 HITL 确认，AI 不得静默执行。

---

## 二、packages/ai-tools 工具层

### 2.1 依赖倒置模型

```
apps/web（适配层）  ──实现──>  ToolRuntime（接口）
        │                            ▲
        └──注入──>  packages/ai-tools（纯函数 + 工具定义）
                         │
                         └──> vue-llm ChatTool / defineTool
```

`ToolRuntime` 由应用层实现，内含 pinia/router/表单实例的适配器；工具层只依赖以下契约：

```ts
export interface ToolRuntime {
  /** 当前快照：路由、实体、选中行、筛选、分页 */
  context(): AiContextSnapshot;
  /** 定位可用的表格/表单句柄（按 route meta.aiContext.entity 或显式 id） */
  table(target?: string): TableHandle | undefined;
  form(target?: string): FormHandle | undefined;
  /** 副作用出口：全部返回可撤销结果 */
  navigate(intent: NavigateIntent): Promise<ToolOutcome>;
  audit(event: ToolAuditEvent): void;
}
```

工具层通过 `createAiTools(runtime)` 工厂创建，避免模块级单例；每个工具自带 `execute`，并用 `defineTool` 保持类型。

### 2.2 四工具契约

#### `search_table` — 自然语言 → 筛选/排序

```ts
interface SearchTableArgs { utterance: string; target?: string }
interface SearchTableResult {
  filters: Array<{ field: string; op: 'eq'|'contains'|'gt'|'lt'|'in'; value: unknown }>;
  sorts: Array<{ field: string; order: 'asc'|'desc' }>;
  applied: boolean;
  summary: string;
}
```

- 输入来自用户话语 + `runtime.context()` 的字段字典（`meta.aiContext.fields`）。
- 输出先走 `runtime.table().applyQuery()`，再回显「已按 X=Y 筛选，共 N 条」。
- 未声明字段字典的表格**不推断**，返回 `applied:false` 并提示补充上下文——防止生成不存在的字段。

#### `generate_form` — 自然语言 → JSON Schema + 打开弹窗

```ts
interface GenerateFormArgs { description: string; template?: string }
interface GenerateFormResult { schema: JsonSchema7; opened: boolean; formId: string }
```

- Schema 由「意图 + 页面声明的实体字段 + 已有模板」合并，字段类型必须落在 form-ui `FormSchema.component` 白名单内。
- 只负责**打开**弹窗与写入 Schema，不提交；提交仍走业务确认。

#### `fill_form_fields` — AI 推断并回填（Smart Fill）

```ts
interface FillFormFieldsArgs { fields?: string[]; source?: 'context'|'history'|'description' }
interface FillFormFieldsResult {
  values: Record<string, unknown>;
  filled: string[];
  skipped: string[];
  confidence: Record<string, number>;
}
```

- 数据源优先级：当前选中行 > 路由参数 > 历史相似记录 > 用户描述。
- 低置信度（默认 < 0.7）字段**不自动填**，进入 `skipped` 并提示人工补录。
- 回填后表单进入「待确认」态，必须由人点击保存。

#### `navigate_to` — 意图 → 路由

```ts
interface NavigateToArgs { utterance: string }
interface NavigateIntent { name: string; params?: Record<string, string>; query?: Record<string, string> }
```

- 目标路由从 `meta.aiContext.links` 与菜单清单中做受控匹配，禁止自由拼接 path。
- 命中后由 `runtime.navigate()` 调用应用 router，返回 `ToolOutcome`。

### 2.3 通用返回与审计

```ts
interface ToolOutcome<T = unknown> {
  ok: boolean;
  data?: T;
  message: string;
  /** 危险操作由 UI 层挂起，等待 addResult */
  confirmation?: { title: string; impact: string; risks: string[] };
  traceId: string;
}
```

每次调用写 `ToolAuditEvent { tool, args, result, ms, traceId, route }`，汇入 Control Plane 的 Trace 列表。

---

## 三、AI 管理 Control Plane

### 3.1 Provider 管理

- 数据：`ProviderRecord { id, name, protocol, endpointRef, apiKeyRef, models[], enabled }`。
- **API Key 只存引用**（环境变量名 / KMS key id），界面只显示末四位；不落明文、不进日志。
- 模型切换是运行时选择，不修改 Provider 定义；`supportsStreaming` 决定 Copilot 是否走流式渲染。

### 3.2 Prompt 模板（按页维护）

- 数据：`PromptTemplateRecord { id, route, name, system, variables[], enabled, version }`。
- 变量来自上下文快照：`{{route}}`、`{{entity}}`、`{{selectedRows}}`、`{{filters}}`。
- 命中顺序：当前路由精确匹配 → 父级路由 → 全局默认；`usePrompt` 对变量做响应式更新，切换选中行即重算 System Prompt。
- 模板变更留版本，支持回滚。

### 3.3 Context 治理

- Token 预算：单次请求上限、System Prompt 上限、历史轮数上限，分别可配。
- 压缩策略：`none | drop-oldest | summarize`。选中行序列化优先保留 `id/name/status`，长文本截断并标注 `[truncated]`。
- 脱敏：沿用 `server/utils/security/masking.ts`，PII/密钥在进 Prompt 前打码。

### 3.4 Trace

- 记录：工具名、参数摘要、耗时、Token 用量、结果状态、确认人、traceId。
- 页面按 traceId 串联「AI 决策 → 工具调用 → 业务接口 → 结果」，支持按路由/时间/状态筛选。
- Trace 只读，不提供编辑与删除（审计完整性）。

---

## 四、动态上下文感知引擎

### 4.1 路由 meta 声明

```ts
declare module 'vue-router' {
  interface RouteMeta {
    aiContext?: {
      entity: string;                        // 实体名，如 approval
      title: string;                         // 给用户看的上下文 Chip 文案
      fields?: Array<{ key: string; label: string; type?: string }>;
      tools?: string[];                      // 本页允许的工具白名单
      links?: Array<{ name: string; intent: string }>;
    };
  }
}
```

### 4.2 快照与指代消解

`useAiContext()` 组合式函数：

1. 读 `route.meta.aiContext`，得实体与字段字典。
2. 订阅表格选中行/当前详情，写入 `selectedRows`。
3. 生成 `AiContextSnapshot { route, entity, title, selectedRows, filters, fields }`。
4. 用户说「重启**它们**」时，先指代消解为选中行 id 列表；无选中行则反问，不猜测。

### 4.3 响应式 System Prompt

```ts
const system = usePrompt(
  computed(() => templateFor(route.name) ?? DEFAULT_TEMPLATE),
  () => ({ route: route.name, entity: ctx.entity, selectedRows: serialize(ctx.selectedRows) }),
);
const chat = useChat({ provider, model, system, tools, onToolCall });
```

`usePrompt` 返回 `ComputedRef<string>`，直接喂给 `useChat` 的 `system`（其类型为 `MaybeRefOrGetter`），切换路由或选中行即更新，不需要重建会话。

---

## 五、迁移顺序（依赖优先，逐批可回滚）

| 阶段 | 内容 | 回滚点 |
| --- | --- | --- |
| P0 | 新建 `packages/ai-tools`，定义接口与四工具纯函数；单测覆盖 | 删除包，无调用方 |
| P1 | Control Plane 数据层与 REST（Provider/Prompt/Context/Trace） | 删除表与接口 |
| P2 | 路由 meta.aiContext + useAiContext + usePrompt 接线 | 移除 meta 与组合式函数 |
| P3 | Cmd/Ctrl+K 全局入口 + Copilot 工作台（Generative UI / HITL） | 关闭入口开关，回退浮动按钮 |
| P4 | Smart Fill 接入 2 个表单样板页，人工确认闭环 | 关闭工具白名单 |
| P5 | 主菜单移除动态表格/表单演示分组；组件示例迁 VitePress | 菜单种子 revert，页面保留直达 |
| P6 | 全量验证、文档与验收 | — |

**P5 注意**：演示页文件与路由**保留**（避免老书签 404），只从侧栏移除；文档中给出直达链接。

---

## 六、风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 工具层被悄悄塞入 pinia/router | `check:dep` 加包级依赖白名单；核心测试用 `resolve` 断言不可解析 |
| Prompt 注入膨胀、Token 失控 | Context 治理预算截断 + PII 脱敏 + 序列化字段裁剪 |
| AI 生成不存在的字段/路由 | 字段字典和路由白名单双校验，未命中则不执行 |
| 危险操作被静默执行 | `ToolComponentProps.addResult` 挂起，必须人工点击；超时默认取消 |
| 工具重复执行 | 每次调用带 `idempotencyKey`，`navigate_to` 外全部需要确认 |
| 菜单移除导致可达性下降 | 保留路由与文档直达；全局入口可搜索所有页面 |
| 供应商凭证泄露 | 只存引用 + 末四位；日志与 Trace 强制脱敏 |

---

## 七、验收标准

1. **架构**：`packages/ai-tools` 的 `package.json` 无 `pinia`/`vue-router`/UI 包依赖；`pnpm check:dep` 不报新增违规。
2. **入口**：任意页面按 Cmd/Ctrl+K 打开命令面板，可发送快捷指令或按 `aiContext.links` 跳转到受控页面。
3. **上下文**：在声明了上下文的页面选中一行后打开 Copilot，上下文 Chip 显示实体与选中行数；指代消解只回 inject 已注册的选中行。
4. **Generative UI**：工具执行状态与明细在对话内用 Collapsible 折叠展示；表格筛选结果由页面表格句柄接管，Copilot 不直接渲染业务专有组件。
5. **HITL**：危险操作只返回确认卡片与用户决策，Copilot 不代业务系统执行写请求；点取消后状态为 cancelled 且不产生审计成功记录。
6. **Smart Fill**：样板表单点击「智能预填」后低置信度字段留空，人工确认后才提交；刷新后数据持久化。
7. **Control Plane**：Provider/Prompt/Context/Trace 四页 CRUD 可用，Trace 能按 traceId 串联完整链路；API Key 不出现在任何列表与日志。
8. **收敛**：主菜单无「动态表格/动态表单」分组；VitePress 有对应文档页与直达链接；旧路由仍可访问。
9. **质量**：新增/改动文件类型检查零错误；新增单测全绿；存量失败数不增加。

---

## 八、当前实现映射

| 契约 | 落地位置 |
| --- | --- |
| `ToolRuntime` 与四工具 | `packages/ai-tools/src/**` |
| 上下文引擎 | `apps/web/src/composables/ai/use-ai-context.ts` |
| Copilot 工作台 | `apps/web/src/components/ai-assistant/**` |
| Control Plane 页面 | `apps/web/src/views/ai/control-plane/**` |
| Control Plane API | `apps/backend-mock/server/api/ai/control-plane/**`（数据层 `db/ai-control-plane.ts`，4 张 SQLite 表） |
| LLM Provider 适配 | `apps/web/src/components/ai-assistant/provider.ts`（接真模型只换此文件） |
| HITL 确认卡片 | `apps/web/src/components/ai-assistant/components/ConfirmActionCard.vue` |
| 工具进度 Generative UI | `apps/web/src/components/ai-assistant/components/ToolProgress.vue` |
| 表格/表单句柄注入 | `apps/web/src/composables/ai/page-registry.ts` |
| 安全工具（脱敏/审计） | `apps/backend-mock/server/utils/security/**` |

### 落地进度

- P0 `packages/ai-tools` 已完成（12 个单测，类型检查零错误，无 pinia/router/UI 依赖）。
- P1 Control Plane 已完成（Provider/Prompt/Context/Trace 四页 + REST + SQLite）。
- P2 上下文引擎已完成（`<route>` 块的 `meta.aiContext` + `usePrompt` 响应式 System Prompt）。
- P3 Copilot 已完成（Cmd/Ctrl+K、上下文 Chip、动态 Prompt、缩略表、工具进度折叠、HITL 确认）。
- P4 Smart Fill 契约已落地，样板页可在任意声明了 `fields` 的页面复用。
- P5 演示页保留路由与文档直达；主导航收敛与 e2e 硬断言的取舍见「风险」一节。
