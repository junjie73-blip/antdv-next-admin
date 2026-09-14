# Antdv Next Vue Admin

现代化企业级后台管理系统模板，基于 Vue 3 + TypeScript + Antdv Next + Tailwind CSS。

---

## 技术栈

| 类别   | 技术               | 版本      |
| ------ | ------------------ | --------- |
| 框架   | Vue 3 + TypeScript | 3.5 / 5.9 |
| UI     | Antdv Next         | ^1.3.1    |
| 样式   | Tailwind CSS v4    | ^4.2.1    |
| 状态   | Pinia 3            | ^3.0.4    |
| 路由   | Vue Router 4       | ^4.6.4    |
| HTTP   | Alova 3            | ^3.5.1    |
| i18n   | vue-i18n           | ^11.4.4   |
| Excel  | xlsx               | ^0.18.5   |
| 构建   | Vite 8             | ^8.2.2    |
| 包管理 | pnpm               | ^10.12.4  |

---

## 快速开始

```bash
pnpm install
pnpm dev
# 访问 http://localhost:9080
```

---

## 项目结构

```
src/
├── api/                    # API 接口定义
├── assets/                 # 静态资源
├── components/
│   ├── business/           # Table / Form / Modal / Drawer
│   ├── LockScreen/         # 锁屏
│   └── common/             # 通用组件
├── composables/            # 组合式函数
├── config/                 # 项目配置（constants 等）
├── directives/             # 自定义指令（v-permission / v-safe-html / v-escape / v-log-click）
├── locales/                # i18n（zh-CN / en-US）
├── layouts/                # 布局系统
├── router/                 # 路由
├── stores/
│   ├── modules/
│   │   ├── app.ts          # 主题/布局/语言
│   │   ├── user.ts         # ★ 用户态 + 登录逻辑（session 主入口）
│   │   ├── route.ts        # 动态路由
│   │   └── dict.ts         # 字典
│   └── index.ts
├── utils/
│   ├── cache/              # 加密缓存（SM4）
│   ├── crypto/             # AES / SM4 / hash / jwt
│   ├── request/            # alova 客户端（http）
│   ├── ws.ts               # ★ WebSocket 单例
│   ├── excel.ts            # Excel 导出
│   ├── print.ts            # 打印
│   └── ...
├── views/                  # 页面
│   ├── login/              # 登录 + 忘记密码
│   ├── register/           # 注册
│   ├── system/             # 系统管理
│   └── ...
├── App.vue
└── main.ts
```

---

## 核心约定

### 登录

**必须携带 `tenantCode`**（后端多租户要求）：

```ts
await userStore.login(username, password, tenantCode);
// → POST /auth/login { tenantCode, username, password }
```

登录页会记住上次的 `tenantCode`（`localStorage.last_tenant_code`）。

### 会话存储

| Key             | 内容         | 有效期 |
| --------------- | ------------ | ------ |
| `auth_token`    | accessToken  | 7h     |
| `refresh_token` | refreshToken | 3h     |
| `user_info`     | 用户信息     | —      |

**不要**把整个登录响应塞进去，只 `pick` 需要的字段。

### UserInfo 结构

```ts
export interface UserInfo {
  userId: string;
  username: string;
  realname?: string;
  nickname?: string;
  avatar?: string;
  email?: string;
  phone?: string;
  tenantId?: string;
  roles: string[];
  permissions: string[];
}
```

### 忘记密码

登录页 → "忘记密码" → 弹窗：

```ts
POST /auth/forgot-password
{ tenantCode, username, oldPassword, newPassword }
```

成功后回填登录表单。

### WebSocket 单例

**整应用只连一条 WS**，通过 `useWs()` 获取：

```ts
const ws = useWs();

// 订阅新通知（返回取消订阅函数）
const off = ws.onNotice((notice) => { ... });
onUnmounted(() => off());

// 订阅强制下线（业务额外逻辑；跳登录由单例内部自动处理）
const off2 = ws.onForceLogout((data) => { ... });

// 全局共享 ref（最近一条通知）
const { notice } = useWs();
```

**消息类型**：
- `notice` — 站内通知
- `force-logout` — 强制下线（**注意短横线**）

WS URL 自动带 token：`/ws?token=xxx&type=notice`。token 变化自动重连，登出自动断开。

### 请求（Alova）

**推荐用法**（`api/system.ts` 封装）：

```ts
import { get, post, put, del } from "@/api/request";

export function getUserList(params) {
  return get<{ list: any[]; total: number }>("/user/list", params);
}

export function updateUser(id, data) {
  return post(`/user/update/${id}`, data);   // 后端用 POST
}
```

**原始用法**（需要精细控制）：

```ts
import { http } from "@/utils";

await http.Post("/auth/login", body);
const res = await http.Get("/user/list", { params }).send(true);
```

**自动处理**：
- 401 → 自动用 refresh token 刷新，刷新失败跳登录
- 5xx → 统一提示"服务器繁忙"
- 4xx → 展示后端 message
- 失败重试（指数退避 + 抖动），仅 5xx / 网络错误

### 状态管理

| Store           | 用途                             |
| --------------- | -------------------------------- |
| `useUserStore`  | 用户态 + 登录/登出（**主入口**） |
| `useAppStore`   | 主题、布局、语言、设置           |
| `useRouteStore` | 动态路由（来自后端菜单）         |
| `useDictStore`  | 数据字典                         |

> ⚠️ `useAuthStore`（`stores/modules/auth.ts`）是历史遗留空壳，**不要再使用**，统一走 `useUserStore`。

### 缓存

`utils/cache` 提供 SM4 加密缓存：

```ts
import { cache, localStorageCacheStorage } from "@/utils/cache";

cache.setItem("key", value, 3600);  // 秒
cache.getItem("key");
```

**注意**：`cache/encrypt.ts` 的 `encryptValue` 是异步的，但 `cache/index.ts` 的 `serialize` 是同步签名。**要么统一改成同步（`encryptValueSync`），要么改成异步接口**。

### 权限指令

```vue
<a-button v-permission="'user:create'">新增</a-button>
<div v-permission:any="['user:edit', 'user:delete']">操作</div>
```

### 安全

- `v-safe-html`：过滤 XSS
- `v-escape`：自动转义
- CSRF：**当前实现是前端生成 token（无效）**，如有安全需求改由后端下发

---

## 关键文件说明

| 文件                                  | 作用                             |
| ------------------------------------- | -------------------------------- |
| `stores/modules/user.ts`              | 登录、登出、token 管理、用户信息 |
| `utils/ws.ts`                         | WebSocket 单例 + 事件总线        |
| `utils/request/alova.ts`              | HTTP 客户端、401 刷新、错误处理  |
| `views/login/index.vue`               | 登录页（含租户编码）             |
| `views/login/ForgotPasswordModal.vue` | 忘记密码弹窗                     |

---

## 环境变量

| 变量                     | 说明                                  |
| ------------------------ | ------------------------------------- |
| `VITE_APP_TITLE`         | 项目标题                              |
| `VITE_PORT`              | 开发端口（默认 9080）                 |
| `VITE_APP_BASE_API`      | API 基础路径                          |
| `VITE_CACHE_ENCRYPT_KEY` | 缓存加密密钥（**生产必须**，32 字符） |

---

## 常见坑

| 现象                    | 原因                                              | 修复               |
| ----------------------- | ------------------------------------------------- | ------------------ |
| 登录 400 "缺少租户标识" | 未传 `tenantCode`                                 | 表单加字段         |
| 用户信息闪空            | `setUserInfo` 里请求了 `/auth/profile`，未 await  | 直接用传入参数     |
| `userId` 显示 NaN       | `Number(uuid)`                                    | 保持字符串         |
| 收到强制下线不跳登录    | WS 消息类型写 `forceLogout`                       | 改 `force-logout`  |
| 每个组件都连 WS         | `useWs` 每次新建                                  | 改单例             |
| 登出后主题丢了          | `logout` 里 `cache.clear()` + `location.reload()` | 只清 auth 相关 key |
| 忘记密码误报成功        | `res?.success === false`（后端无此字段）          | 删掉判断           |