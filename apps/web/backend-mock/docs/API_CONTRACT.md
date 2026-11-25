# Backend Mock API 接入规范

> 本文件由 `pnpm openapi:generate` 自动生成，规格原文见 [openapi.json](./openapi.json)。
> 服务运行时也可直接访问 `GET /openapi`（规范）与 `GET /docs`（交互式文档）。

## 1. 概览

- **Base URL**：开发 `http://localhost:6080`，官方 `nitro/vite` 插件与前端共用同一端口，`/api` 直连；切换真实后端时只替换 baseURL。
- **内容类型**：请求与响应均为 `application/json; charset=utf-8`。
- **接口数量**：141 个（覆盖 `server/api` 下全部路由）。
- **认证**：请求头 `Authorization: Bearer <token>`；mock 未带 token 时回落 admin，
  便于联调；设置 `MOCK_AUTH_ENFORCE=1` 后未登录请求返回 code 401。

## 2. 统一响应格式

所有接口（含错误）响应体固定三个字段，与真实后端 `R<T>` 完全一致：

```json
{ "code": 200, "data": { "...": "..." }, "message": "ok" }
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | integer | 业务码，200 表示成功；其余见下方码表 |
| `data` | any | 业务数据；失败时恒为 `null` |
| `message` | string | 可直接展示的描述；校验失败时会带出字段路径 |

可观测信息通过响应头下发，不进入业务信封：

| 响应头 | 说明 |
| --- | --- |
| `x-request-id` / `x-trace-id` | 链路号，与审计台账 `traceId` 对应 |
| `x-response-time` | 服务端耗时，如 `12ms` |
| `cache-control: no-store` | 禁止缓存（同一 URL 会因账号返回不同数据） |
| `vary: Authorization` | 代理必须按凭据区分缓存 |

## 3. 状态码体系

业务失败默认 **HTTP 仍为 200**，由前端按 `code` 判定；仅运行时拦截（全局停用 / 失败注入）
同步抬升 HTTP 状态。这样可以与真实后端的拦截器行为保持一致。

| code | 类别 | 成功 | 默认文案 |
| --- | --- | --- | --- |
| 200 | 成功 | 是 | ok |
| 400 | 客户端错误 | 否 | 请求参数错误 |
| 401 | 客户端错误 | 否 | 未登录或登录已过期 |
| 403 | 客户端错误 | 否 | 没有操作权限 |
| 404 | 客户端错误 | 否 | 请求的资源不存在 |
| 405 | 客户端错误 | 否 | 请求方法不被允许 |
| 409 | 客户端错误 | 否 | 资源状态冲突 |
| 422 | 客户端错误 | 否 | 请求语义错误 |
| 429 | 客户端错误 | 否 | 请求过于频繁 |
| 500 | 服务端错误 | 否 | 服务器内部错误 |
| 503 | 服务端错误 | 否 | 服务暂不可用 |

## 4. 标准错误结构

```json
{
  "code": 400,
  "data": null,
  "message": "参数校验失败：query.pageNum 必须大于 0"
}
```

字段级明细保存在服务端 `ApiError.items`（字段路径 / 描述 / 子码），写入审计日志供联调定位，
但不直接出现在响应体中 —— 避免把内部实现暴露给调用方。

## 5. 分页约定

- 入参：`pageNum`（从 1 开始，兼容别名 `page`）+ `pageSize`（1-200，缺省 10）。
- 出参：`{ "list": [...], "total": number }`，`total` 是筛选后总条数。
- 不传任何分页参数时兼容旧行为返回全量；一旦出现分页参数就按页切片。

## 6. 参数校验

统一使用 zod schema（代码侧见 `server/contracts/models.ts` 与 `validation.ts`）：
必填、长度、枚举、邮箱 / 手机号格式、日期格式、数值范围都有约束。
校验失败返回 code 400，`message` 形如 `参数校验失败：body.password 密码不能为空`。

## 7. 权限标识

权限码格式 `模块:资源:动作`，与菜单派生规则一致。前端用于控制按钮可见性，
服务端通过 `requirePermission` 做二次校验（未通过返回 code 403）。

| 权限码 | 含义 |
| --- | --- |
| `system:user:list` | 查看用户列表 |
| `system:user:query` | 查询用户详情 |
| `system:user:add` | 新增用户 |
| `system:user:edit` | 编辑用户 |
| `system:user:remove` | 删除用户 |
| `system:role:list` | 查看角色列表 |
| `system:role:add` | 新增角色 |
| `system:role:remove` | 删除角色 |
| `demo:task:list` | 查看任务列表 |
| `demo:task:add` | 新增任务 |
| `demo:task:edit` | 编辑任务 |
| `demo:task:remove` | 删除任务 |
| `security:audit:list` | 查看审计台账 |
| `approval:mine:list` | 查看我的审批 |
| `approval:mine:save` | 发起审批 |
| `approval:mine:action` | 审批操作 |

已落地服务端鉴权的接口：

| 接口 | 权限码 |
| --- | --- |
| 新增任务 | `demo:task:add` |
| 删除用户 | `system:user:remove` |
| 新增用户 | `system:user:add` |
| 用户列表 | `system:user:list` |

## 8. 操作日志与审计

每次请求由统一管道写入审计台账，字段与真实后端 `tb_operation_log` 对齐：
`actor`（操作人）、`action`（`METHOD /path`）、`module`、`bizType` / `bizId`、
`method`、`path`、`ip`（代理头优先）、`detail`（脱敏后的请求参数 + 标准操作日志字段）、
`result`（success / error / denied）、`risk`、`traceId`、`startTime` / `endTime`、`durationMs`。

请求体先经服务端脱敏策略处理，凭据、证件号等敏感字段不会落库。

## 9. 前端接入示例

```ts
const res = await fetch('/api/system/user/list?pageNum=1&pageSize=10', {
  headers: { Authorization: `Bearer ${token}` },
});
const envelope = await res.json();
if (envelope.code !== 200) {
  console.error(envelope.message, 'traceId:', res.headers.get('x-request-id'));
  throw new Error(envelope.message);
}
const { list, total } = envelope.data;
```

## 10. 迁移为真实后端

1. 保持路径、方法、信封、分页结构、权限码不变 —— 前端零改动。
2. 把 `server/middleware/auth-context.ts` 的账号解析替换为验签 / 会话查询。
3. 把 `server/utils/db/*` 的内存 / SQLite 集合换成真实 DAO；`server/contracts/*` 的 DTO 可继续复用。
4. `defineMockRoute` 的运行时管道（延迟 / 失败注入）仅用于联调，生产服务移除即可。
5. 审计落点从 `recordAudit` 换成写入 `tb_operation_log` 的持久化实现，字段无需调整。

## 11. 接口清单

- `DELETE /api/ai/agent/{id}`
- `GET /api/ai/agent/list`
- `POST /api/ai/agent/save`
- `POST /api/ai/chat`
- `DELETE /api/ai/control-plane/context/{id}`
- `GET /api/ai/control-plane/context/list`
- `POST /api/ai/control-plane/context/save`
- `DELETE /api/ai/control-plane/prompt/{id}`
- `GET /api/ai/control-plane/prompt/list`
- `POST /api/ai/control-plane/prompt/save`
- `DELETE /api/ai/control-plane/provider/{id}`
- `GET /api/ai/control-plane/provider/list`
- `POST /api/ai/control-plane/provider/save`
- `GET /api/ai/control-plane/trace/list`
- `DELETE /api/ai/flow/{id}`
- `GET /api/ai/flow/list`
- `POST /api/ai/flow/save`
- `DELETE /api/ai/knowledge/{id}`
- `GET /api/ai/knowledge/list`
- `POST /api/ai/knowledge/save`
- `DELETE /api/ai/model/{id}`
- `GET /api/ai/model/list`
- `POST /api/ai/model/save`
- `GET /api/ai/overview`
- `DELETE /api/ai/provider/{id}`
- `GET /api/ai/provider/list`
- `POST /api/ai/provider/save`
- `DELETE /api/approval/group/{id}`
- `GET /api/approval/group/list`
- `POST /api/approval/group/save`
- `DELETE /api/approval/level/{id}`
- `GET /api/approval/level/list`
- `POST /api/approval/level/save`
- `DELETE /api/approval/mine/{id}`
- `GET /api/approval/mine/{id}`
- `POST /api/approval/mine/action`
- `POST /api/approval/mine/extend`
- `GET /api/approval/mine/list`
- `POST /api/approval/mine/resubmit`
- `POST /api/approval/mine/save`
- `GET /api/approval/monitor/list`
- `GET /api/approval/monitor/summary`
- `POST /api/approval/timeout/scan`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/user-info`
- `GET /api/dashboard/stats`
- `DELETE /api/demo/task/{id}`
- `GET /api/demo/task/{id}`
- `PUT /api/demo/task/{id}`
- `POST /api/demo/task`
- `GET /api/demo/task/list`
- `GET /api/demo/task/options`
- `GET /api/enterprise/report/datasets`
- `GET /api/menus`
- `GET /api/mock-center/generated`
- `GET /api/mock-center/logs`
- `POST /api/mock-center/logs/clear`
- `GET /api/mock-center/overview`
- `POST /api/mock-center/preview`
- `POST /api/mock-center/route-runtime`
- `GET /api/mock-center/routes`
- `POST /api/mock-center/routes/remove`
- `POST /api/mock-center/routes/save`
- `POST /api/mock-center/runtime`
- `GET /api/mock-center/templates`
- `GET /api/screen/monitor`
- `GET /api/security/ai-calls/list`
- `DELETE /api/security/ai-policy/{id}`
- `GET /api/security/ai-policy/list`
- `POST /api/security/ai-policy/save`
- `POST /api/security/alerts/{alertId}/handle`
- `GET /api/security/alerts/list`
- `GET /api/security/audit/list`
- `GET /api/security/audit/stats`
- `GET /api/security/events/list`
- `POST /api/security/guard/preview`
- `DELETE /api/security/mask-policy/{id}`
- `GET /api/security/mask-policy/list`
- `POST /api/security/mask-policy/save`
- `GET /api/security/score`
- `GET /api/security/stats`
- `GET /api/system/captcha-log/list`
- `GET /api/system/client-log/list`
- `GET /api/system/config/list`
- `PUT /api/system/config/reset`
- `PUT /api/system/config/save`
- `DELETE /api/system/dept/{id}`
- `PUT /api/system/dept/{id}`
- `POST /api/system/dept`
- `GET /api/system/dept/list`
- `GET /api/system/dept/tree`
- `DELETE /api/system/dict/{id}`
- `PUT /api/system/dict/{id}`
- `POST /api/system/dict`
- `POST /api/system/dict/item`
- `DELETE /api/system/dict/item/{id}`
- `PUT /api/system/dict/item/{id}`
- `GET /api/system/dict/items/{typeId}`
- `GET /api/system/dict/list`
- `DELETE /api/system/file/{id}`
- `PUT /api/system/file/{id}`
- `POST /api/system/file/folder`
- `GET /api/system/file/list`
- `GET /api/system/file/tree`
- `POST /api/system/file/upload`
- `DELETE /api/system/log/{id}`
- `GET /api/system/log/list`
- `GET /api/system/login-log/list`
- `GET /api/system/login-log/stats`
- `GET /api/system/monitor/snapshot`
- `DELETE /api/system/notice/{id}`
- `GET /api/system/notice/list`
- `PUT /api/system/notice/read-all`
- `PUT /api/system/notice/read/{id}`
- `POST /api/system/notice/save`
- `DELETE /api/system/online/{tokenId}`
- `GET /api/system/online/list`
- `DELETE /api/system/post/{id}`
- `PUT /api/system/post/{id}`
- `POST /api/system/post`
- `GET /api/system/post/list`
- `GET /api/system/post/users/{postId}`
- `GET /api/system/record/{module}/{id}`
- `DELETE /api/system/role/{id}`
- `PUT /api/system/role/{id}`
- `POST /api/system/role`
- `GET /api/system/role/list`
- `DELETE /api/system/settings/{id}`
- `PUT /api/system/settings/{id}`
- `POST /api/system/settings`
- `GET /api/system/settings/list`
- `DELETE /api/system/user/{id}`
- `GET /api/system/user/{id}`
- `PUT /api/system/user/{id}`
- `POST /api/system/user`
- `GET /api/system/user/list`
- `GET /api/system/user/options`
- `GET /api/table/list`
- `POST /api/upload`
- `POST /api/upload/{variant}`
