# backend-mock：从内存 Mock 数据迁移到 SQLite — 实施方案与可行性评估

> 适用范围：`apps/backend-mock`（基于 Nitro 的 Mock 服务）关联改动约束：前端 `apps/web` 与 `packages/*` 的契约（响应信封 `ApiEnvelope<T>`）**必须保持不变**
>
> **历史文档**：下文提到的 `enterprise/workflow`、`tb_workflow`、`WORKFLOW_STORE` 与 `db-workflow-config-e2e.test.ts` 均已随「工作流引擎」模块删除；相关段落只用于说明当时的迁移方法，不再代表当前代码。配置域持久化测试现为 `test/config-persistence-e2e.test.ts`。

---

## 0. 现状盘点（基于代码实测）

为避免误判，先澄清一个事实：**数据主路径早已不在 MockJS 上**。

| 维度 | 现状 |
| --- | --- |
| 运行形态 | Nitro `preset: node-server`，`srcDir: 'server'`，由 apps/web 的 vite 插件以 5320 端口编程式拉起（进程内）；独立跑时读 `PORT`/`NITRO_PORT` |
| 接口规模 | **95 个端点**（GET 44 / POST 24 / PUT 14 / DELETE 13），分布在 `system/*`、`auth`、`mock-center`、`demo`、`enterprise/workflow`、`security`、`ai`、`dashboard`、`screen`、`upload`、`table` 等域 |
| 数据层 | `server/utils/db/*` **15 个模块**，每个导出一个 `*_DB` 预生成数组 + 一组 CRUD 辅助函数（`next*Id()`、`paginate()`、`select*()`、增删改） |
| 数据生成 | 全部用 **`@faker-js/faker`**（`faker.seed(N)` 固定种子保证可复现）+ `dayjs`，**不用 MockJS** |
| MockJS 残留 | 仅 `server/utils/templates.ts` 第 82 行的 `Mock.mock(template)` —— 服务于运行时「Mock 数据中心」**用户自定义接口模板**（`mock-center` 生成式路由），属于数据**生成器**，不是数据**存储** |
| 响应契约 | 统一走 `envelope/success/bizError/httpError` → `ApiEnvelope<T>`（`@antdv/types`），前端 `request.ts` 依 `code` 判定业务成败 |
| 运行时状态 | 全局开关 / 单接口停用 / 延迟 / 失败注入 持久化在 `.mock-state.json`（与数据存储解耦） |
| 测试 | `vitest`（node 环境），`#imports` 别名到 `test/fixtures/nitro-imports.ts`；**无** SQLite/ORM 依赖 |
| 构建 | `nitro build`；原生模块在 node-server preset 下默认被 external 到 node_modules，运行时加载 |

**结论**：本次迁移的真实对象是「**faker 种子 + 内存数组**」→「**SQLite 文件数据库**」。MockJS 在数据主路径上已不存在；迁移后仅保留它用于 `mock-center` 的运行时模板渲染即可。

---

## 1. 实施方案

### 1.1 数据建模

**驱动选型（推荐→备选）**

1. **`better-sqlite3`**（主推）：同步 API，零 async 噪声，与现有 handler 的同步数组访问风格天然一致；Nitro node-server 下自动 external，运行时从 node_modules 加载。
2. **`node:sqlite`**（零原生依赖备选）：Node ≥ 22.1 内置（实验性，需 `--experimental-sqlite` 标志）；在本机/CI 若 `better-sqlite3` 在 Windows + 映射盘 J: 上编译/加载失败，改用此方案可彻底规避原生构建风险。

**落地位置**：`apps/backend-mock/.data/mock.sqlite`（纳入 `.gitignore`，避免把测试数据提交进库）。

**迁移范围**（关键取舍 —— 只建模「可变实体」，不动静态/派生数据）：

| 类别 | 模块 | 是否建模 |
| --- | --- | --- |
| 可变实体（有 `next*Id()` + `*_DB` CRUD） | `user`、`dept`、`role`、`post`、`dict`（类型 + 条目）、`notice`、`file`、`online`、`log`（操作日志）、`login-log`、`client-log`、`captcha-log`、`settings`、`config`、`task`、`workflow` | **建模** |
| 静态选项 / 纯计算快照 | `security`（events/alerts/score/stats 运行时生成）、`monitor`（快照）、`enterprise`（ai 资源 / report 数据集 / 工作流静态定义）、`dashboard/stats`、`screen/monitor` 等 | **保持内存常量，不建模** |

**表设计原则（遵循阿里数据库规范）**

- **主键使用 cuid**：每张表主键统一为 `id TEXT PRIMARY KEY`，取值由 `cuid`（cuid2）生成，**不再使用 `INTEGER AUTOINCREMENT` 自增整型**。弃用现有 `next*Id` 手算，改用统一 `genId()`（返回 cuid）。cuid 为分布式安全的时间序 + 随机串，满足「去自增、防遍历、跨重启唯一」。
- **统一软删除**：每张表（含关联表）必须包含 `deleted INTEGER NOT NULL DEFAULT 0`（0=未删除，1=已删除）与 `deleted_at TEXT`（删除时间，未删除为 NULL）。**所有删除一律软删除**——`remove` 仅置 `deleted=1` 并写 `deleted_at`，绝不做物理 `DELETE`。`list`/`getById` 默认强制附带 `deleted = 0` 过滤；回收站 / 恢复类场景通过显式 `includeDeleted` 开关读取。
- **关联用第三张表、禁用外键**：表之间**不使用外键约束（FOREIGN KEY）**，改用中间关联表（junction table）表达关系。例如用户与部门不再在 `tb_user` 内嵌 `dept_id`，而是建 `tb_user_dept(user_id, dept_id, …)`；多对多（角色↔权限、用户↔角色、用户↔岗位）同样用独立关联表。关联表自身也带 `deleted`/`deleted_at`（逻辑删除整条关系）。
- 检索高频字段建索引（`username`、`status`、`type_id`、`create_time`、`deleted` 以及关联表两端的 id）。
- 时间字段统一存 ISO 字符串或 `INTEGER`（epoch ms），与现有 `dayjs` 输出对齐。
- 配置类（`config`、`settings`）本身是 KV，直接用 `(key, value, module)` 表或 JSON 列。

**种子策略**（保留现有可复现性）

- 复用现有 faker 生成器生成初始数据；`faker.seed(N)` 仍用于首次播种，保证同种子同数据。
- `.data/mock.sqlite` 不存在或 **seed 版本戳不匹配** 时自动重建（版本戳存于表 `__meta`）。
- 提供脚本：`pnpm mock:seed`（强制重建并写入种子数据）、`pnpm mock:reset`（删库 + 重建）。
- 因 SQLite 成为唯一真实源，重启后读取 DB 而非重新 faker —— 这正是迁移的核心收益（跨重启一致）。

**DDL 示例（user 表）**

```sql
CREATE TABLE IF NOT EXISTS tb_user (
  id         TEXT PRIMARY KEY,            -- cuid，不使用自增整型
  username   TEXT NOT NULL,
  nickname   TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  gender     INTEGER NOT NULL DEFAULT 0,
  roles      TEXT NOT NULL DEFAULT '[]',  -- JSON 数组
  status     INTEGER NOT NULL DEFAULT 1,
  remark     TEXT,
  avatar     TEXT,
  deleted    INTEGER NOT NULL DEFAULT 0,  -- 软删除标记：0=未删 1=已删
  deleted_at TEXT,                        -- 删除时间，未删除为 NULL
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_status  ON tb_user(status);
CREATE INDEX IF NOT EXISTS idx_user_deleted ON tb_user(deleted);

-- 用户 ↔ 部门 关联表（第三张表，不使用外键）
CREATE TABLE IF NOT EXISTS tb_user_dept (
  id         TEXT PRIMARY KEY,            -- cuid
  user_id    TEXT NOT NULL,               -- 关联 tb_user.id
  dept_id    TEXT NOT NULL,               -- 关联 tb_dept.id
  is_primary INTEGER NOT NULL DEFAULT 1,  -- 是否主部门（一人可多部门）
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_dept_user ON tb_user_dept(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dept_dept ON tb_user_dept(dept_id);
```

### 1.1.1 文件上传与文件管理接口（对接真实接口）

迁移后文件相关记录仍建模为 `tb_file`（cuid 主键 + 软删除），但其写入入口必须对接**真实文件上传接口**，明确地址、请求方式与参数，避免「mock 不落盘」的演示接口与持久化登记混为一谈。

**① 文件管理页 —— 元数据登记（持久化，对接真实存储）**

| 项 | 内容 |
| --- | --- |
| 接口地址 | `POST /api/system/file/upload` |
| 请求方式 | `POST`（multipart/form-data 或 JSON） |
| 鉴权 | 沿用现有登录态（`cookie`/`token`），与 `/api` 其余端点一致 |
| 请求参数 | `name`（文件名，必填）、`type`（`FileType`：`image`/`document`/`video`/`audio`/`archive`/`other`/`folder`，必填）、`extension`（扩展名）、`size`（字节数，必填）、`mimeType`（MIME，必填）、`path`（存储路径，默认 `/`）、`parentId`（父目录 id，`number \| null`，可空） |
| 响应（成功） | `ApiEnvelope<FileRecord>`：`code=200`、`data` 为新建 `FileRecord`（`id` 为 cuid、`url`/`storedPath` 为真实可访问地址、`uploader`/`uploaderId` 取自当前登录用户），`message='文件上传成功'` |
| 说明 | 这是**真正登记落库**的入口；迁移后 `FileRecord` 写入 `tb_file`（软删除）。真实后端应在此完成对象存储（OSS / S3 / 本地磁盘）写入后回填 `url`；mock 仅负责元数据登记与返回结构 |

**② 组件示例「上传」演示（非持久化，纯成功响应）**

| 项 | 内容 |
| --- | --- |
| 接口地址 | `POST /api/upload`、`POST /api/upload/:variant`（`variant` ∈ `image`/`avatar`/`custom`/`status`/`validate`/`manual`/`drag-sort`） |
| 请求方式 | `POST`（multipart/form-data，antd `Upload` 的 `action` 直接消费） |
| 请求参数 | 标准文件表单字段（`file`），由浏览器 `Upload` 组件自动携带；变体名经路径参数传入 |
| 响应（成功） | `ApiEnvelope<UploadResult>`：`data` 含 `variant`、`fileId`、`url`（内联 SVG data URL 占位预览）、`storedPath`（展示用路径）、`uploadedAt`；**此接口不落库、不写 `tb_file`**，仅用于演示页「上传成功」交互 |
| 说明 | 二者（`/upload` 与 `/system/file/upload`）职责必须分清：演示接口只回成功结构，登记接口才持久化。本文档凡提及「文件上传」，默认指 ① 的真实登记接口 |

> 注：原 `server/utils/upload.ts` 的 `uploadSuccess`/`buildUploadResult` 继续服务于 ② 演示接口；`/system/file/upload` 的 handler（`system/file/upload.post.ts`）改为经 `DataStore.insert('tb_file', …)` 落库，返回结构不变。

### 1.2 接口层适配

目标：**handler 与响应信封完全不动**，只把 `server/utils/db/*` 的内部实现从「数组运算」换成「SQLite 查询」。靠一层仓储抽象实现。

```
apps/backend-mock/server/
├── utils/
│   ├── db/
│   │   ├── connection.ts     # 单例连接（挂在 globalThis，抗 Nitro dev 热重载）
│   │   ├── seed.ts           # DDL + 播种（复用 faker 生成器）
│   │   ├── store.ts          # DataStore 抽象接口 + MemoryStore / SqliteStore 两实现
│   │   ├── user.ts           # 仅保留 UserRecord 类型 + 导出 getXxx 仓储方法
│   │   ├── ...（其余 14 个模块同构改造）
│   ├── templates.ts          # MockJS 模板渲染 —— 保留不动（mock-center 生成式接口）
```

**连接单例（抗热重载要点）**

```ts
// connection.ts
import Database from 'better-sqlite3';
const KEY = Symbol.for('mock-sqlite');
const g = globalThis as any;
export function getDb(): Database.Database {
  if (!g[KEY]) {
    const file = resolve('.data/mock.sqlite');
    const db = new Database(file);
    db.pragma('journal_mode = WAL'); // 并发读写，避免写阻塞读
    g[KEY] = db;
  }
  return g[KEY];
}
```

**仓储抽象（双实现，受开关驱动）**

```ts
// store.ts
export interface DataStore {
  list<T>(
    table: string,
    opts: QueryOpts & { includeDeleted?: boolean },
  ): { list: T[]; total: number };
  getById<T>(table: string, id: string): T | undefined;
  insert(table: string, row: Record<string, unknown>): string; // 返回 cuid
  update(table: string, id: string, patch: Record<string, unknown>): void;
  remove(table: string, id: string): void; // 软删除：置 deleted=1，非物理 DELETE
  restore?(table: string, id: string): void; // 可选：恢复（deleted 复位）
}
// MOCK_STORE=memory（默认）  → MemoryStore（现有数组逻辑，行为不变）
// MOCK_STORE=sqlite         → SqliteStore（新实现）
export const store: DataStore =
  process.env.MOCK_STORE === 'sqlite'
    ? createSqliteStore(getDb())
    : createMemoryStore(); // ← 现有逻辑兜底，迁移期与回滚期都靠它
```

**适配要点**

- 每个 `db/*.ts` 模块：**保留导出的函数签名**（如 `getDictList`、`paginateList`），仅把函数体换成 `store.xxx(...)`，handler 零改动。
- **cuid 主键落地**：`insert` 内部统一调用 `genId()`（`cuid()`）生成主键并写入 `id`；种子数据同样走 `genId()`，取消所有 `next*Id` 自增手算。所有对外返回的 `id` 字段类型由 `number` 改为 `string`，前端已有的 `string` 化展示不受影响。
- **软删除落地**：`remove(table, id)` 重写为 `UPDATE … SET deleted=1, deleted_at=now WHERE id=?`；`list`/`getById` 在构造 SQL 时自动追加 `AND deleted = 0`（除非 `includeDeleted` 显式开启）；**禁止**在仓储层出现物理 `DELETE`。回收站 / 恢复类接口复用 `restore()`。
- **关联表落地（去外键）**：原内嵌的 `dept_id`/`role_id`/`post_id` 等引用列移除，改由 `tb_user_dept`、`tb_user_role`、`tb_role_menu` 等关联表承载；查询关联数据时以 `JOIN` 关联表（无 FK 约束）实现，写入 / 解除关系即对关联表 `insert`/`remove`（软删除关联行）。
- 现有 `paginate<T>`、`selectLogs`、`selectWorkflowDefinitions` 等筛选/排序/分页逻辑，逐条翻译成参数化 SQL（LIKE 模糊、`ORDER BY`、分页 `LIMIT/OFFSET`），语义必须与前端当前依赖保持一致（此前已修过多处分页字段不一致，移植时不得回归）。
- **`mock-center` 生成式路由**（`preview.post.ts`、`middleware/generated.ts`、`templates.ts`）继续用 MockJS 模板产出随机 payload，与 SQLite 的命名实体存储互不影响。
- 运行时开关 / 延迟 / 失败注入 / 命中日志（`.mock-state.json`）完全不改。

### 1.3 迁移步骤（分阶段，每阶段可独立验收）

| 阶段 | 内容 | 出口条件（Definition of Done） |
| --- | --- | --- |
| **P0 · 技术探针** | 在本机 + CI 验证 `better-sqlite3`（或 `node:sqlite`）能在 Nitro `node-server` 构建产物与 `vitest` 中正常加载/读写；验证 WAL 与热重载下单例不泄漏 | 探针仓库跑通一条 `GET /api/...` 返回 SQLite 数据；CI 矩阵（win/linux）绿灯 |
| **P1 · 基础框架** | 新建 `connection.ts` / `seed.ts` / `store.ts`（双实现 + 开关）；`.data` 目录与 `.gitignore`；`mock:seed`/`mock:reset` 脚本 | `MOCK_STORE=memory` 时行为与今日完全一致；sqlite 实现空跑不报错 |
| **P2 · 逐个实体迁移** | 按难度从低到高把可变实体模块接入 `SqliteStore`：先 `role`/`post`/`dept`（小），再 `user`/`dict`/`notice`/`file`/`task`/`workflow`，最后日志类 | 每迁一个模块，`MOCK_STORE=sqlite` 下该域前端 e2e 全绿、分页/筛选等价 |
| **P3 · 静态/派生模块（可选）** | 评估 `security`/`monitor`/`enterprise` 是否需要落地（多数保持内存常量即可） | 收益不足则跳过，记录在 README |
| **P4 · 下线内存实现** ✅ 2026-11-19 | 删除 `MemoryStore` 与 `MOCK_STORE` 开关，SQLite 成为唯一实现；新增 dev/prod 分库与生产保护 | 全量测试通过；无 `MOCK_STORE` / `MemoryStore` 分支残留（见 §6） |
| **P5 · 验证与上线** | 全量自动化 + 人工验收；更新 `apps/backend-mock/README` 与开发者上手说明 | 见 1.4 |

> 历史策略：P1–P3 保留 `MemoryStore` 兜底。**P4 已执行**：内存实现与 `MOCK_STORE` 开关整体下线，SQLite 是唯一存储；下方 §6 记录落地细节。

### 1.4 验证方式

| 层级 | 手段 | 覆盖目标 |
| --- | --- | --- |
| 单元 | `backend-mock` 增加 `db/seed.test.ts`（种子确定性：`faker.seed` 产物稳定、**cuid 唯一且非空**）、`db/store.test.ts`（CRUD 等价、分页等价、**软删除等价**：`remove` 后 `list` 不可见但 `includeDeleted` 可见、`restore` 可恢复、**关联表** `insert`/`remove` 等价）；扩展既有 `pagination.test.ts` 覆盖 SQL 分页 | 逻辑正确性、分页契约（`pageNum/pageSize`、筛选后 `total`、翻页不重复首屏）、cuid 主键唯一性、软删除与关联表语义 |
| 契约 | 前端 `e2e/table-crud.spec.ts`、`e2e/tree-table.spec.ts` 继续跑；新增「**重启后数据持久化**」用例（建记录 → 重启 server → 仍在） | 前端契约零回归；持久化收益可验证 |
| 集成 | 启动 Nitro，脚本批量请求各域端点，断言 `code===200`、`data.list`/`data.total` 形态不变、分页与 CRUD 往返正确 | 端到端信封对齐 |
| 回归 | `backend-mock test:unit` + `apps/web` playwright；**双实现并行**：CI 同时以 `MOCK_STORE=memory` 与 `MOCK_STORE=sqlite` 两套跑，确保两实现行为一致 | 防实现漂移 |
| 手动 | `pnpm mock:reset` 后前端逐页核对总数/分页/增删改 | 验收 |

---

## 2. 可行性评估

### 2.1 技术优劣

**优势**

- **真实持久化**：数据跨重启、跨进程生命周期一致，前端「新增后刷新仍在」成为真实现状，不再是内存里的一次性假象。
- **贴近后端契约**：SQL 查询语义与真实后端（`SELECT … LIKE/ORDER BY/LIMIT`）一致，前端联调更接近生产。
- **可重置/可观测**：`mock:reset` 一键回到干净种子；可直接 `sqlite3` 打开库排查数据问题。
- **查询能力强**：复杂筛选/关联（用户↔部门↔角色）从 JS 数组遍历变为索引查询，分页性能更稳。
- **依赖收敛**：数据主路径彻底摆脱手写数组增删改样板，逻辑更内聚。
- **符合阿里数据库规范**：cuid 主键（去自增、防遍历）、统一软删除（可恢复、审计友好）、关联表去外键（降低耦合、便于后续分库分表），与主流企业后端规约对齐，迁移后契约更接近生产。

**劣势 / 成本**

- **引入原生依赖**：`better-sqlite3` 需本地编译或预编译二进制，Windows + 映射盘 J: 上存在构建/加载失败概率（CI 矩阵需覆盖）。
- **种子管理复杂度**：需维护 seed 版本戳、可重置脚本，否则数据漂移难排查。
- **SQL 与现有数组语义逐条对齐**：模糊搜索大小写、`dayjs` 排序、JSON 字段（`roles`）等需谨慎移植，回归面不小。
- **迁移期双实现负担**：P1–P4 同时维护 MemoryStore 与 SqliteStore，测试与心智成本翻倍。
- **MockJS 未彻底消失**：`mock-center` 生成式接口仍依赖 MockJS 模板，迁移不解决它。
- **cuid 主键代价**：字符串主键比整型自增更长，索引体积与比较开销略增，且非单调递增、写入热点不如自增友好（mock 量级无感，但需在文档标注）。
- **软删除贯穿所有查询**：`list`/`getById`/`count` 必须统一带 `deleted = 0`，任何遗漏都会泄漏已删数据；唯一 / 统计类查询需显式处理，回归面扩大。
- **关联表替代外键**：关系完整性由应用层保障（无数据库级约束），关联写入 / 解除需成对处理；多对多查询多一次 `JOIN`，复杂关联 SQL 需谨慎移植。

### 2.2 工作量预估（单兵，含测试与联调）

| 阶段 | 内容 | 人日 |
| --- | --- | --- |
| P0 | 原生模块可行性探针 + CI 矩阵 | 1.5 |
| P1 | 连接/种子/双实现框架 + 脚本（含 `genId` cuid、软删除过滤基类、关联表骨架） | 4 |
| P2 | 15 个可变实体模块（易 `role/post/dept` 各 0.5；中 `user/dict/notice/file/task/workflow` 各 1；难 `日志类` 各 0.5） | 10 |
| P3 | 静态/派生模块评估与可选落地 | 2（可选，可省） |
| P4 | 下线内存实现 | 1.5 |
| P5 | 验证、回归、文档 | 2 |
| **合计** |  | **约 22 人日（≈4–5 周）；若跳过 P3 约 20 人日** |

> 难度分级依据：小模块无关联、纯 CRUD；中模块含筛选/分页/JSON 字段；日志类含 `selectLogs` 多条件组合与快照，移植 SQL 最多。cuid 主键（`genId`）、软删除过滤（`deleted=0` 强制注入）、关联表去外键已纳入 P1 框架与 P2 各模块改造，整体人日 +1 左右。

### 2.3 潜在风险与缓解

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| `better-sqlite3` 在 Windows/映射盘编译或加载失败 | 高 | P0 先验证；失败即切 `node:sqlite`（零原生）；CI 双平台矩阵提前暴露 |
| Nitro dev 热重载导致连接句柄泄漏/锁库 | 中 | 单例挂 `globalThis`，进程退出 `db.close()`；用 WAL |
| SQL 移植引入分页/筛选语义回归（前端报错） | 高 | 复用已修的分页契约；移植后跑前端 e2e + 双实现并行 CI |
| `mock-center` 生成式接口在重构中误伤 | 中 | 该路径（templates.ts / middleware/generated.ts）明确不改动，单测守护 |
| 种子版本漂移、脏数据难排查 | 中 | `__meta` 版本戳 + `mock:reset` 强制重建 |
| 内存实现与 SQLite 实现行为漂移 | 中 | 双实现在 CI 同跑同一测试集；统一断言 |
| 迁移期误伤正在服务的进程内 Mock（5320） | 中 | 开关默认 `memory`，sqlite 仅显式开启；改动经重启验证（已知 J: 盘 HMR 不生效，每次包改动需重启） |
| SQLite 写并发（单进程但多请求） | 低 | `journal_mode=WAL`，单写多读足够 |
| `.data/mock.sqlite` 被误提交 | 低 | 纳入 `.gitignore` |
| cuid 主键：索引体积与写入热点 | 低 | 字符串 PK 体积略增；mock 量级无感，仅在文档标注，无需特殊处理 |
| 软删除遗漏 `deleted=0` 过滤导致已删数据泄漏 | 中 | `list`/`getById`/`count` 在仓储基类中统一注入过滤；单测覆盖「删除后不可见 / `includeDeleted` 可见」 |
| 关联表替代外键：应用层漏写 / 漏解除关系 | 中 | 关联写入 / 解除成对封装在仓储方法内；单测覆盖关联增删与查询 |
| 物理 `DELETE` 被误引入破坏软删除规范 | 中 | 代码评审 + 单测断言「无物理 DELETE」；`remove` 仅置位 |

### 2.4 回滚策略

1. **开关即回滚（主手段）**：双实现由 `MOCK_STORE` 环境变量驱动。任何阶段发现 sqlite 异常，**把环境变量切回 `memory` 即瞬间回退到今日行为**，无需改代码、无需重启以外的动作。
2. **代码增量、可整体 revert**：SQLite 层为**新增文件**（`connection/seed/store` 及模块内 SQL 分支），不重写现有内存逻辑；回滚 = 删除新增文件 + 还原被改模块，git 操作干净。
3. **单模块可独立回退**：每个模块仓储走同一抽象，可在模块级临时回指 `MemoryStore`，不影响其他模块。
4. **数据库文件可弃**：`.data/mock.sqlite` 已 gitignore，异常时直接 `pnpm mock:reset` 或删文件重启即回到内存态。
5. **决策闸门**：P0（探针）不通过 → 不进 P1；P2 任一模块 e2e 不绿 → 该模块保持 `memory`；P4（下线内存）仅在全量回归绿灯后执行，且保留开关代码至少一个发布周期，确认线上稳定再删。

---

## 3. 结论与建议

- **建议采用「双实现 + 开关 + 分批迁移」路线**，而非一次性重写：以最低爆炸半径把内存数组替换为 SQLite，同时用 `MemoryStore` 兜底，保证任何时刻都能一键回退。
- **P0 探针是硬前置**：先确认 `better-sqlite3`（或 `node:sqlite`）在本机与 CI（win/linux）都能在 Nitro 产物与 vitest 中正常工作；这一步不过，不要投入后续改造。
- **迁移范围聚焦可变实体**：15 个可变模块优先；静态/派生模块保持内存常量，不强行建模，避免无效工作量。
- **MockJS 不需迁移也无需删除**：数据主路径已无 MockJS；仅 `mock-center` 生成式接口还在用，保留即可。
- **数据库规范对齐阿里标准**：主键统一 cuid（去自增）、全量软删除（状态字段标记）、关联走第三张表（无外键）。这三项已写入 1.1 表设计原则与 1.2 仓储抽象，落地时由 `genId()`、强制 `deleted=0` 过滤、关联表 `JOIN` 三重保障；文件上传写入入口对接真实登记接口 `POST /api/system/file/upload`，演示接口 `/api/upload` 仍仅回成功结构。
- **前端契约是红线**：无论内存还是 SQLite，响应信封 `ApiEnvelope<T>`、`code` 判定、分页字段 `pageNum/pageSize`、`data.list/total` 形态一律不变，靠既有 e2e + 双实现 CI 守护。

> 附：本方案所有结论均基于 `apps/backend-mock` 当前代码结构实测（95 端点、15 个 db 模块、faker 为主、MockJS 仅用于 templates.ts），落地前以 P0 探针结果校准选型与工作量。

---

## 4. 实施进度（2026-11-14 起）

### 4.1 阶段状态

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| **P0 · 技术探针** | ✅ 完成 | 见 4.2 |
| **P1 · 基础框架** | ✅ 完成 | 连接 / DDL / 双实现 / 开关 / 版本戳 / 脚本 / gitignore / 单测齐备 |
| **P2 · 逐个实体迁移** | ✅ 完成（2026-11-16 收尾） | 15 个可变实体 + `dept` 扁平表 + 演示/安全 3 表全部接入；末批 `workflow`/`config`/`dict item id`/`role↔menu` 关联同步已补齐并加端到端持久化测试 |
| P3 · 静态/派生模块 | ⬜ 待办 | 按 1.1 结论，`security` / `monitor` / `enterprise` 保持内存常量 |
| P4 · 下线内存实现 | ⬜ 待办 | 需 P2 全绿后执行 |
| P5 · 验证与上线 | ⬜ 待办 | 需补 CI 双实现矩阵与前端 e2e |

### 4.2 P0 探针结论

本机 `Node v22.22.2` / Windows / J: 映射盘，实测：

| 驱动 | 结果 |
| --- | --- |
| `better-sqlite3@13.2.0`（预编译） | ✅ 直接 require 可读写；✅ vitest node 环境可加载；✅ Nitro `node-server` 构建产物 external 正常 |
| `node:sqlite`（Node 内置） | ✅ `--experimental-sqlite` 下可用，作零原生依赖兜底 |

**主驱动选定 `better-sqlite3`**；`MOCK_SQLITE_DRIVER=node` 可切到内置驱动。`.node` 二进制在 J: 映射盘上加载无异常，2.3 中「Windows 编译失败」风险未发生。

### 4.3 落地时的三处方案校正（重要）

1. **主键采用双键，对外 `id` 保持 number。** 方案 1.2 要求「所有对外返回的 `id` 由 number 改为 string」，但实测 30+ 个 handler 使用 `Number(params.id)`，且 `deptId` / `parentId` / `roleId` / `typeId` / `menuIds` 等关联字段全是 number。直接切 cuid 会击穿整条 CRUD 链路，与「前端契约是红线」直接冲突。 **处理**：物理主键 `_pk TEXT PRIMARY KEY` = cuid（满足去自增、防遍历、跨重启唯一），对外业务 `id` 仍是 number，另存 `biz_id` 列；整行业务数据放 `data` JSON 列，`Object.keys(record)` 只暴露业务字段，不泄漏内部列。

   > 若后续确实要对外切 string id，必须同步改造所有 `Number(params.id)`、前端表单/下拉/TreeSelect 的 value 类型及 e2e 断言，属于独立变更，不在本次范围。

2. **用「透明持久化集合」兑现 handler 零改动。** 方案假设 handler 通过 `getRoleList` / `paginate` 仓储函数取数；实测 handler 直接 `import { XXX_DB }` 并对数组做 `[...DB]` / `find` / `push` / `splice` / `DB[i] = {...}`，甚至直接改行对象（`notice.status = 1`）和嵌套数组（`dictType.items.push(x)`）。 **处理**：`defineCollection()` 返回数组 Proxy + 行 Proxy + 嵌套数组 Proxy 三层代理，把上述写操作翻译成 `insert` / `update` / `remove`（软删除），读操作每次拉最新快照。`MOCK_STORE=memory` 时直接返回普通数组。`role` 的 4 个 handler **确实一行未改**。

3. **筛选 / 排序 / 分页暂不下推 SQL。** 方案 1.2 要求逐条翻译成参数化 SQL，但 2.3 自评该项回归风险最高。当前 `list()` 只负责存储 + `deleted=0` 过滤 + 取全量，筛选仍由现有 handler 的 JS 逻辑与 `paginateList` 完成，**零语义回归**。`DataStore.list` 已预留 `where` / `pageNum` / `pageSize` 参数（双实现等价测试覆盖），下推留到 P3 单独做。

### 4.4 已交付文件

| 文件 | 职责 |
| --- | --- |
| `server/utils/db/sqlite/schema.ts` | DDL 单一真源（零 import，脚本可直接 import）：`__meta` + 17 张实体表 + 4 张关联表 + 索引，全部 `_pk` cuid 主键、软删除列、无外键 |
| `server/utils/db/sqlite/ids.ts` | `genId()` (cuid2) / `idKey()` / `nowIso()` |
| `server/utils/db/sqlite/connection.ts` | `globalThis` 单例、WAL、包根探测（跳过 `-prod` 产物声明）、惰性加载驱动 |
| `server/utils/db/sqlite/store.ts` | `DataStore` 接口 + `MemoryStore` / `SqliteStore`，含软删除 / 恢复 / 关联表 `link`·`unlink`·`links` |
| `server/utils/db/sqlite/collection.ts` | `defineCollection()` 透明集合 + `nextBizId()`（替代模块级自增变量） |
| `server/utils/db/sqlite/seed.ts` | `__meta.seed_version` 版本戳与重建 |
| `server/utils/db/sqlite/runtime.ts` | `getStore()` / `isSqliteEnabled()` 单例与开关（独立文件避免循环依赖） |
| `server/utils/db/sqlite/index.ts` | 统一出口 |
| `scripts/mock-db.mjs` | `mock:seed` / `mock:reset` / `mock:db:info` |
| `server/utils/db/role.ts` | P2 首个接入模块（4 个 handler 零改动） |
| `test/db-store.test.ts` | 双实现等价：CRUD / 分页 / 软删除 / 恢复 / 关联表 / cuid |
| `test/db-collection.test.ts` | Proxy 读写 / 嵌套数组 / `Object.keys` 不泄漏 / 重启持久化 / memory 回滚 |
| `test/db-role-e2e.test.ts` | 直接调用真实 handler：信封 / 分页 / CRUD 往返 / 软删除 / 重启 / 详情页 |
| `server/utils/db/sqlite/kv-map.ts` | KV 字典透明持久化代理（config 面板，handler 零改动） |
| `test/db-workflow-config-e2e.test.ts` | workflow / config 真实 handler 端到端：信封不变 + 新建/删除/改配置/重置的重启持久化 |

同时更新：`package.json`（依赖 + 脚本）、根 `package.json`（`mock:*` 透传）、`.gitignore`（`.data/`）、`nitro.config.ts`（`better-sqlite3` external）。

### 4.5 验证结果

- `pnpm --filter @antdv/backend-mock test:unit`：**141 / 141 通过**（默认 memory 模式）
- `MOCK_STORE=sqlite pnpm --filter @antdv/backend-mock test:unit`：**141 / 141 通过**（双实现行为一致，见 4.7 收尾）
- `pnpm --filter @antdv/backend-mock type-check`：**零错误**
- `pnpm --filter @antdv/backend-mock build`：Nitro `node-server` 产物构建成功
- `pnpm mock:seed` / `mock:reset` / `mock:db:info`：可用，DDL 与版本戳正常
- 核心收益已验证：新增记录 → 模拟重启 → 仍在；删除记录 → 重启未复活；重启后新增 id 不撞号

### 4.6 启用与回滚

```bash
# 启用 SQLite（默认仍是 memory，今日行为不变）
MOCK_STORE=sqlite pnpm --filter @antdv/backend-mock dev

# 运维
pnpm mock:seed       # 强制重建（删库 + 建表 + 写版本戳）
pnpm mock:reset      # 删库，下次启动重建并播种
pnpm mock:db:info    # 查看版本戳与各表行数

# 回滚：去掉环境变量即可，代码零改动
```

种子数据由 `defineCollection` 在模块加载时惰性灌入（表空才写），取自 `server/utils/builtin-data.ts` 的确定性内置数据表；库文件 `apps/backend-mock/.data/mock.sqlite` 已 gitignore。

### 4.7 P2 收尾（2026-11-16 完成）

§5 的「去模拟数据改造」已把 15 个可变实体 + `dept` 扁平表 + 演示/安全集合接入 `defineCollection`；本节记录当时点名未接的最后几项，现已全部补齐：

| 模块 | 处理 | 落点 |
| --- | --- | --- |
| `workflow`（`enterprise.ts` 的 `WORKFLOW_STORE`） | `items` 改用 `defineCollection({ table: 'tb_workflow' })`；4 个 handler 零改动 | `db/enterprise.ts` |
| `config`（`monitor.ts` 的 `CONFIG_VALUES`） | 对象字典非数组，新增 `defineKVMap()` 代理，每面板在 `tb_config` 存一行；save/reset/list handler 零改动 | `db/sqlite/kv-map.ts`、`db/monitor.ts` |
| dict item id | `nextDictItemId()` 在 sqlite 分支遍历内嵌 `items` 取 max+1，避免重启撞号 | `db/dict.ts` |
| `role↔menu` 关联 | `syncRoleMenuLinks()` 接入 `role/[id].put.ts`，带 `menuIds` 时同步关联表（软删除） | `api/system/role/[id].put.ts` |

验证：`test/db-workflow-config-e2e.test.ts`（6 用例，直接调真实 handler）覆盖信封不变、新建/删除/改配置/重置的**重启持久化**；单测 141/141 通过、type-check 零错误。

**2026-11-18 复核补记（双实现并行验收）**：此前 141/141 只在默认 memory 模式成立， `MOCK_STORE=sqlite` 跑全量时 `demo-task.test.ts` 有 2 个失败，与 §1.4「双实现行为一致」的验收要求冲突。根因与修复：

| 缺口 | 根因 | 修复（最小兼容） |
| --- | --- | --- |
| 删除后行仍可见 | 该测试的 `afterEach` 用 `TASK_DB.length = 0` 还原快照（全仓库仅此一处），sqlite 数组代理的 `set` trap 原样忽略 `length` 赋值，快照还原失效、数据跨用例累积 | `collection.ts` 的 `set` trap 对 `length = 0` 走 `store.truncate`（reset 语义，非业务软删）；memory 分支不受影响 |
| 新增 id 不满足 `>100` | `db/task.ts` 的 memory 起点写死 101，sqlite 用 `nextBizId()`=库内 max+1（种子 26 条→27），双实现起点漂移 | 抽 `TASK_ID_START = 101` 常量，sqlite 分支改 `Math.max(TASK_ID_START, nextBizId(...))`；memory 分支不变 |
| 测试污染真实库 | `demo-task` 等老测试直读写 `*_DB`、无临时库逻辑，sqlite 下污染 `.data/mock.sqlite` 且依赖历史脏数据，验收不可重复 | `vitest.config.ts`：sqlite 模式且未显式指定 `MOCK_DB_FILE` 时注入 `MOCK_DB_FILE=:memory:`；带临时库的 db-* e2e 自行覆盖，不受影响 |

修复后 memory / sqlite 两模式均 **141 / 141 通过**；真实库经 `mock:seed` 重建回干净种子。

静态/派生模块（`security` / `monitor` 快照 / `enterprise` 资源与报表数据集 / `dashboard` / `screen`）按 1.1 结论**不建模**。

### 4.8 已知限制

- 关联表已建好并有等价测试，但迁移期 `menuIds` / `deptId` 等仍在业务行内保留以维持前端契约，属于**双写**；P2 全量完成后再改为关联表唯一真源。
- 集合的 `sort` / `reverse` 只作用于临时快照，不持久化展示顺序（现有 handler 排序都发生在自己的 `filtered` 数组上，无影响）；`unshift` 落库后排在末尾，语义与 JS `unshift` 不完全一致（现有代码未使用）。
- ~~`syncRoleMenuLinks()` 已提供角色↔菜单关系同步，待接入授权流程后调用。~~ ✅ 2026-11-16 已接入 `role/[id].put.ts`。
- 文件上传：`POST /api/system/file/upload` 走 `FILE_DB.push()` → `defineCollection(tb_file)`，已落库；演示接口 `/api/upload` 按 1.1.1 保持不落库。
- `better-sqlite3` 采用惰性 `createRequire` 加载（保证 memory 模式不依赖原生模块），因此 Nitro 产物的 `.output/server/package.json` 不会自动列出它；部署需一并安装 `apps/backend-mock/package.json` 声明的依赖。
- CI 双实现矩阵（`MOCK_STORE=memory` / `sqlite` 各跑一遍）与前端 Playwright e2e 尚未补，见 P5。

---

## 5. 去模拟数据改造（2026-11-15）

> 本章记录「彻底移除 faker / mockjs 及模拟数据生成内容，所有接口改为真实业务逻辑」的落地结果。上文 §0–§3 是改造前的现状盘点与方案评估，作为历史记录保留；§4 的 P0/P1/P2 结论仍然有效，但其中「复用 faker 生成器」「MockJS 保留」等描述已被本章取代。

### 5.1 决策前提（三处歧义已确认）

| 决策点 | 结论 |
| --- | --- |
| 真实数据源 | 以 SQLite 为真实存储；初始数据改为**确定性内置数据**（`builtin-data.ts`），等价真实后端的 init data |
| 静态常量 | 菜单、字典、部门树、监控快照等视为系统内置配置数据保留；**删除其中所有随机生成与伪造逻辑** |
| Mock 数据中心 | **整体下线**：模板渲染、生成式路由、预览生成、浏览器 mock 层、fixtures、前端页面与相关脚本全部移除 |

### 5.2 服务端（95 个接口逐个清点）

- **数据层**：15 个 `utils/db/*.ts` 全部去掉 `@faker-js/faker`，改为 `builtin-data.ts` 的确定性常量池 + 递增游标（零随机、跨重启一致）；种子里残留的 `Math.random()`、自研 LCG 伪随机、`dayjs()` 运行期时间全部清除（统一 `BUILTIN_NOW` 固定基准）。
- **真实存储**：12 个实体模块 + `dept` 扁平表 + 演示表格 / 安全事件 / 告警共 15 张集合统一接入 `defineCollection`；`next*Id()` 在 SQLite 下取库内 max+1，重启不撞号。
- **运行时随机接口改真实聚合**（10 个）：
  - `dashboard/stats`、`security/stats`、`security/score`、`screen/monitor` → 由 `utils/derive.ts` 按固定日期轴对真实记录聚合；
  - `table/list` → 从 `tb_table_demo` 真实分页，`total` 取实际行数（不再写死 100）；
  - `security/events/list`、`security/alerts/list` → 从持久化集合分页；
  - `security/alerts/:id/handle` → 真实移除告警（原来恒返回 success）；
  - `system/post/users/:postId` → 按部门从 `USER_DB` 真实查询（原来凭 `userCount` 现造用户）；
  - `system/user/index.post` → 头像按真实 id 生成确定性地址。
- **假 CRUD 修复**：`dept` 的 `POST/PUT/DELETE` 原来只回显构造对象、不写数据，现改为真实增删改；部门树由 `buildDeptTree()` 按 parentId 从真实存储实时组装。
- **Mock 数据中心下线**：`templates.ts` 去掉 mockjs，预置模板改纯 JSON 配置；`renderPreview` 只校验 + 原样回显；删除 `server/middleware/generated.ts` 生成式路由；`generated.get` 返回空清单、`routes/save|remove` 保留路径与结构但不再注册假路由。11 个 `mock-center/*` 接口路径与返回结构全部保留（兼容红线），其中 `overview/routes/logs/runtime` 返回的是真实运行时统计，本就不是假数据。

### 5.3 前端

- 删除 `apps/web/src/mock/`（浏览器拦截层 + 14 个文件及其单测）、`src/api/mock.ts`、`views/tool/mock/`、`scripts/generate-mock-fixtures.mjs`、`apps/web/scripts/verify-prod-mock.mjs`、`.mock-state.json`。
- `main.ts` 移除浏览器 mock 装载；`post/index.vue` 移除 faker 造的 30 个假用户，改为 `getUserList()` 真实取数。
- 6 个演示组件里 26 处 `Math.random()` 换成 `utils/deterministic.ts` 的确定性序列（动画仍有变化但可复现、可断言）。
- 配置：`.env.production` 关闭 `VITE_MOCK`（生产 `/api` 由部署方反向代理到真实后端）；dev 保留 `VITE_MOCK=true`，因为它现在控制的是**启动本地 Nitro 真实后端服务**而非模拟数据。删除 `verify:prod-mock`、`mock:fixtures` 脚本。

### 5.4 依赖与配置清理

移除 `@faker-js/faker`（backend-mock、apps/web）、`mockjs`、`@types/mockjs` 三个依赖声明，以及 `pnpm-workspace.yaml` 对应 catalog 条目与 `pnpm-lock.yaml` 中的解析记录。删除 `legacy-mock/` 20 个存档文件。

### 5.5 兼容与部署风险

- **接口契约**：95 个接口路径、请求参数、响应信封（`ApiEnvelope`）、分页字段 `pageNum/pageSize`、`data.list/total` 形态、调用方式全部不变。
- **生产部署变更**：浏览器内请求拦截层已移除，生产产物不再自带接口应答。部署时必须提供真实后端服务或把 `/api` 反向代理到 `apps/backend-mock` 的 Nitro 服务，否则首屏菜单/用户信息会取不到。
- **dev 不变**：`VITE_MOCK=true` 仍启动 Nitro 服务并代理 `/api`，只是该服务已改为真实业务逻辑与 SQLite 持久化。
- **前端 type-check**：存在历史存量错误（`Recordable` / `.data` 类型，源自早期 API 包合并），本次新增与修改的文件经核对为零新增错误。

---

## 6. P4 落地：SQLite 唯一实现 + 开发/生产环境区分（2026-11-19）

> 本章落实 §4 的 P4，并响应「接口全部用 SQLite、不使用 faker 等模拟技术、区分开发与生产」的要求。§0–§5 作为历史记录保留；凡与本章冲突处，以本章为准。

### 6.1 下线内存实现（SQLite 唯一存储）

- 删除 `MemoryStore` 类与 `MOCK_STORE` 环境变量开关：`runtime.ts` 的 `getStore()` 恒返回 `SqliteStore`，所有接口无论环境都走 SQLite 真实读写，无任何内存数组兜底分支。
- 清理 8 个 `utils/db/*.ts` 的 `isSqliteEnabled() ? nextBizId() : autoIncrement++` 分支与模块级自增变量，统一用 `nextBizId(table)`（库内 max+1，重启不撞号）。`isSqliteEnabled` 导出一并移除。
- `collection.ts` / `kv-map.ts` 去掉 `store.kind === 'memory'` 分支；`index.ts` 不再导出内存相关符号。
- 测试：`db-store.test.ts` 去掉双实现矩阵只留 SqliteStore；`db-collection.test.ts` 删「memory 回滚」用例，改为「生产只建表不播种」用例；`vitest.config.ts` 默认注入 `MOCK_DB_FILE=:memory:` 隔离测试。

### 6.2 faker / 模拟技术确认

- 全仓扫描确认：`@faker-js/faker` / `mockjs` 依赖与 import 已彻底移除（§5 已执行），生成随机数据仅剩控制面用途（`route-meta.ts` / `runtime.ts` 的 `shouldInjectFailure` 有可注入的 `random` 参数，用于失败率边界测试），业务数据零随机。`builtin-data.ts` 为手写常量池 + 递增游标，无 `Math.random`。

### 6.3 环境区分（`utils/db/sqlite/env.ts`）

| 维度 | development / test | production |
| --- | --- | --- |
| 库文件 | `.data/mock.sqlite` | `.data/mock.production.sqlite` |
| 首次启动播种 | 是（内置确定性数据） | **否**（只建表，数据由接口/运维写入） |
| seed 版本变更 | 清库重建 | 不触碰已有数据 |
| 运行时控制面写接口 | 放行 | **403 拦截**（见 6.4） |
| `mock:seed` / `mock:reset` | 直接执行 | 需显式 `--force` |

- 判定优先级：`MOCK_ENV` > `NODE_ENV` > `development`。`package.json` 的 `start` / `preview` 脚本显式注入 `NODE_ENV=production MOCK_ENV=production`；`dev` 注入 `MOCK_ENV=development`。
- `MOCK_DB_FILE` 显式覆盖始终优先（测试 / 运维 / 迁移用）。
- 系统配置默认值（`tb_config` / `CONFIG_DEFAULTS`）属运行所需配置项，非伪造业务记录，所有环境都会初始化。

### 6.4 生产环境保护（`utils/prod-guard.ts` + `middleware/prod-guard.ts`）

生产环境拦截以下运维/控制面写接口（返回 HTTP 403 + 业务码 403）： `POST /api/mock-center/runtime`、`route-runtime`、`logs/clear`、`routes/save`、`routes/remove`、 `PUT /api/system/config/reset`。普通业务接口与所有只读/统计接口放行。

### 6.5 验收证据（2026-11-19）

- `pnpm type-check`：零错误。
- `pnpm test:unit`：**16 文件 / 141 用例全绿**（新增 `db-env.test.ts` 9 用例）。
- `pnpm build`：Nitro `node-server` 产物构建成功。
- 真实 HTTP 冒烟（构建产物 + 临时库）：
  - prod：角色列表为空（未播种）；config 面板正常初始化；控制面写接口 403；新建角色后读回成功（SQLite 持久化）。
  - dev：角色列表有 6 条种子；控制面写接口 200 放行。
  - 两环境库文件物理隔离（`/tmp/mock-dev-smoke.sqlite` 与 `/tmp/mock-prod-smoke.sqlite`）。
