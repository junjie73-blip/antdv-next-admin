# 安全设计与合规说明

本文档描述本模板的内建安全能力、责任边界与扩展方式。它是一套**可验证的工程基线**，不是安全认证证书：具体系统上线前仍需结合真实网关、KMS、WAF 与等保测评完成落地。

## 1. 安全总览

模板按「纵深防御」组织，任何单层失效都不应直接导致数据泄露：

| 层 | 能力 | 实现位置 |
| --- | --- | --- |
| 接入层 | CSRF 双提交令牌、统一错误信封、CORS 白名单、生产环境危险操作拦截 | `packages/core/base/shared/src/utils/csrf.ts`、`packages/request/src/fetcher.ts`、`apps/backend-mock/nitro.config.ts`、`server/middleware/prod-guard.ts` |
| 身份与权限 | 菜单即权限、账号白名单裁剪、按钮级 `v-permission`、角色菜单授权持久化 | `server/utils/accounts.ts`、`packages/stores/src/route.ts`、`packages/directives/src/permission/`、`views/system/role/index.vue` |
| 数据层 | SQLite 持久化、软删除、生产不播种、敏感字段服务端脱敏 | `server/utils/db/sqlite/`、`server/utils/security/masking.ts` |
| 审计层 | 全链路五元组审计、AI 调用台账、链路 ID 透传、前端不再伪造告警 | `server/utils/runtime.ts`、`server/utils/db/security-advanced.ts`、`views/security/**` |
| AI 专属 | 提示词注入检测、PII/密钥识别、输出审核、调用限流、风险分级 | `server/utils/security/ai-guard.ts`、`server/api/ai/chat.post.ts` |

安全中心入口：**安全中心 → 安全总览 / 审计日志 / 脱敏策略 / AI 安全策略 / AI 调用审计**。

## 2. 数据全生命周期安全

### 采集与传输
- 请求统一经 `packages/request` 的 fetcher：自动注入 `X-CSRF-Token`，401 统一登出，业务错误码与非 2xx 分离。
- Mock 运行时对所有响应强制 `cache-control: no-store` 与 `vary: Authorization`，避免按会话分数据的接口被浏览器缓存串号。
- 每个请求生成或透传 `X-Request-ID`，响应回写同名头；审计记录里可直接按链路 ID 检索。

### 存储
- 统一使用 `better-sqlite3`（`node:sqlite` 兜底），业务 id 保持 number，物理主键与软删除由存储层维护。
- 生产环境（`MOCK_STORE=sqlite` + 生产配置）**不自动播种**演示数据，避免把测试账号和演示 PII 带进生产库。
- 表结构白名单 `assertTableName()` 防止动态 SQL 注入；所有写操作走白名单 DTO，前端传的 `progress` 等派生字段会被忽略。

### 使用与脱敏
- 服务端脱敏是唯一真源：`masking.ts` 对手机号、邮箱、证件号、银行卡、密钥按策略打码；`password/token/secret/api-key/authorization/cookie` 等凭据键**无条件整体打码**，不受策略开关影响。
- 前端 `@antdv/shared/utils/masking` 仅用于二次展示兜底，永远不能替代服务端脱敏。
- 审计详情与 AI 提示词摘要落库前都经过 `sanitizePayload()`，并有深度/长度上限，防止超大请求体拖垮存储。
- 策略可在「安全中心 → 脱敏策略」增删改，并提供「策略演练」即时验证判定结果。

### 审计与销毁
- 每条经 `defineMockRoute` 的请求都生成 `actor / action / target / ip / result / traceId` 五元组记录；审计台账自身读取不产生递归记录。
- 业务删除使用软删除；审计台账设计为只增不改，满足追责要求。

## 3. 权限与审计

- 后端菜单种子 `server/api/menus.get.ts` 是页面级授权真源：`admin` 可见全树，`custom` 按叶子 name 白名单裁剪。新增页面必须登记菜单（可 `hidden`），否则路由守卫会按越权处理。
- 按钮级权限使用 `v-permission="'security:xxx:list'"` 与表格 `ActionItem.auth`；`custom` 账号在安全中心只有总览与审计的只读权限，策略配置按钮不可见。
- 角色授权抽屉现在会把 `menuIds` 提交到 `PUT /system/role/:id`，后端同步角色↔菜单关联表，刷新后仍生效。
- 审计日志位于「系统管理 → 系统日志」，安全事件位于「系统监控」，AI 与接口审计位于「安全中心」。

## 4. AI 场景专属安全

AI 调用链：`AiAssistant / AiChat → POST /ai/chat → AI 安全网关 → Mock 回复 → 输出审核 → AI 调用审计`。

1. **输入网关**：`assessPrompt()` 识别「忽略之前指令 / 系统提示词索取 / DAN / 越权扮演」等注入，命中后按策略阻断或脱敏。
2. **敏感信息**：手机号、邮箱、证件号、银行卡、密钥在送入模型前打码；回显用的是脱敏后的文本，避免 PII 被原样返回。
3. **输出审核**：`moderateOutput()` 拦截密钥与脚本片段，策略可配置为自动脱敏或直接阻断。
4. **风险分级**：low / medium / high / critical，随响应返回 `risk`、`blocked`、`categories`，右侧 AI 助手会在高风险时显示安全提示。
5. **调用留痕**：每次调用写入 AI 调用审计（脱敏摘要 + 判定 + 链路 ID）；限流窗口内的高频调用也会被记录。
6. **可调策略**：提示词注入、输入脱敏、输出审核、全量留痕、频率阈值均在「AI 安全策略」页面配置，保存后立即生效。

> 当前 Mock 的限流是单进程内存窗口。接入真实网关时，将 `callHistory` 替换为 Redis/API Gateway 限流，并保留同一套策略键与判定结果即可。

## 5. 合规对照

| 控制域 | 模板内建能力 | 上线仍需补齐 |
| --- | --- | --- |
| 身份鉴别 | 登录错误态、密码锁定策略字段、CSRF、会话接口禁缓存 | MFA、密码复杂度服务端强校验、令牌轮换 |
| 访问控制 | 菜单/按钮两级授权、角色菜单授权持久化、越权路由拦截 | 数据行级权限、租户隔离、审批授权流程 |
| 安全审计 | 五元组审计、AI 调用台账、链路 ID、只读审计页面 | 日志外发 SIEM、不可篡改存储、留存周期策略 |
| 数据完整性/保密性 | 服务端脱敏、密钥末四位掩码、软删除 | 传输证书校验、字段级加密、KMS 托管密钥 |
| 入侵防范 | 注入检测、输出过滤、生产危险操作拦截 | WAF、RASP、IP 信誉、容器基线 |
| 个人信息保护 | PII 自动打码、最小回显、策略可关停 | 数据分类分级台账、删除权/导出权流程 |

## 6. 验证方式

```bash
pnpm --filter @antdv/backend-mock type-check
pnpm --filter @antdv/backend-mock test:unit   # 含 security-advanced.test.ts
pnpm --filter @antdv/web type-check
pnpm --filter @antdv/web test:unit
```

安全专项单测覆盖：按类型脱敏、凭据无条件打码、结构化载荷递归脱敏、提示词注入识别、PII 脱敏判定、输出脚本拦截、策略演练接口、注入请求阻断并落审计、普通对话脱敏回显、审计统计、评分维度、策略保存即时生效。

## 7. 扩展点

- **接真实模型**：替换 `apps/backend-mock/server/api/ai/chat.post.ts` 中 `buildReply(...)` 一行，安全网关与审计无需改动。
- **接真实审计**：保留 `recordAudit()` / `recordAiCall()` 签名，把实现换成消息队列或日志服务。
- **新增脱敏类型**：扩展 `MaskType`、`TYPE_PATTERNS`，在策略页增加选项即可。
- **新增 AI 风险规则**：在 `PROMPT_INJECTION` / `OUTPUT_RISK` 增加检测项，并配置对应策略键。
- **生产菜单持久化**：当前菜单种子是静态常量，`views/system/menu` 的增删改在演示环境保存到内存；接生产时应把种子迁移到 `defineCollection` 并让 `GET /menus` 读取同一份数据。

## 8. 已知边界

- Mock 服务不联网、不读取真实密钥，供应商 API Key 只保存末四位掩码。
- 限流为进程内实现，重启归零；多实例部署必须换成集中式限流。
- 安全评分是内建事件与策略的派生指标，不等同于第三方漏洞扫描结论。
