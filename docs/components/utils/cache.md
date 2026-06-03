# 缓存存储 (localStorageCacheStorage)

基于 `createCache` 创建的缓存存储实例，封装了 `localStorage` 操作，支持序列化、加密、过期时间等高级功能。

## 为什么不用原生 localStorage

| 维度 | 原生 localStorage | 本项目 localStorageCacheStorage |
|------|-------------------|-------------------------------|
| **类型安全** | 所有值都是 string | 自动序列化/反序列化，支持任意类型 |
| **过期时间** | 不支持 | 支持 TTL 过期自动清理 |
| **数据加密** | 明文存储 | 可选 AES 加密存储 |
| **命名空间** | 全局共享，容易冲突 | 统一前缀隔离，避免 key 冲突 |
| **错误处理** | JSON.parse 可能抛异常 | 内部 try-catch，返回 null 而非报错 |
| **批量操作** | 需手动遍历 | 提供 `clear()` 按前缀批量清除 |

## 基础用法

```ts
import { localStorageCacheStorage } from '@/utils/cache'

// 存储数据
localStorageCacheStorage.setItem('username', '张三')

// 读取数据
const name = localStorageCacheStorage.getItem('username')
// 返回: '张三' (string) 或 null

// 删除数据
localStorageCacheStorage.removeItem('username')
```

## API 方法列表

### setItem — 存储数据

```ts
setItem(key: string, value: T, expire?: number): void
```

| 参数 | 说明 | 类型 | 必填 |
|------|------|------|------|
| `key` | 缓存键名 | `string` | ✅ |
| `value` | 缓存值（任意类型） | `T` | ✅ |
| `expire` | 过期时间（秒） | `number` | ❌ |

```ts
// 永久存储（不过期）
localStorageCacheStorage.setItem('theme', 'dark')

// 带过期时间的存储（1 小时后过期）
localStorageCacheStorage.setItem('token', 'abc123', 3600)

// 存储 30 分钟后过期
localStorageCacheStorage.setItem('userInfo', { name: '张三', role: 'admin' }, 1800)
```

### getItem — 读取数据

```ts
getItem(key: string): T | null
```

```ts
// 读取字符串
const token = localStorageCacheStorage.getItem<string>('token')
// 返回: 'abc123' 或 null

// 读取对象（自动反序列化）
const user = localStorageCacheStorage.getItem<{ name: string }>('userInfo')
// 返回: { name: '张三' } 或 null

// 读取已过期的数据 → 返回 null
const expired = localStorageCacheStorage.getItem('expired-key')
// 返回: null (即使存在，但已过期)
```

### removeItem — 删除数据

```ts
removeItem(key: string): void
```

```ts
localStorageCacheStorage.removeItem('token')
```

### hasItem — 判断是否存在

```ts
hasItem(key: string): boolean
```

```ts
if (localStorageCacheStorage.hasItem('token')) {
  // token 存在且未过期
}
```

### clear — 批量清除

```ts
clear(): void
```

按前缀批量删除所有缓存数据：

```ts
// 清除当前应用的所有缓存
localStorageCacheStorage.clear()
```

> 注意：只会清除以配置的前缀开头的缓存项，不会影响其他应用的 localStorage 数据。

## 高级 API

### getExpire — 获取剩余过期时间

```ts
getExpire(key: string): number | null
```

返回指定 key 的剩余有效时间（单位：秒）。如果永不过期或不存在则返回 `null`。

```ts
const remaining = localStorageCacheStorage.getExpire('token')
if (remaining !== null && remaining > 0) {
  console.log(`Token 还剩 ${Math.ceil(remaining / 60)} 分钟`)
}
else if (remaining !== null && remaining <= 0) {
  console.log('Token 已过期')
}
```

### setExpire — 设置新的过期时间

```ts
setExpire(key: string, expire: number): boolean
```

为已有的缓存项设置新的过期时间。成功返回 `true`，key 不存在返回 `false`。

```ts
// 延长 token 有效期 2 小时
localStorageCacheStorage.setExpire('token', 7200)
```

### touch — 刷新过期时间（续期）

```ts
touch(key: string, expire?: number): boolean
```

刷新已有缓存项的过期时间。默认续期 1 小时（3600 秒）。

```ts
// 用户操作时刷新 token 过期时间（滑动过期）
function handleUserActivity() {
  const refreshed = localStorageCacheStorage.touch('token', 3600)
  if (!refreshed) {
    // token 不存在或已过期，需要重新登录
    redirectToLogin()
  }
}
```

### keys — 获取所有缓存键名

```ts
keys(): string[]
```

返回当前前缀下所有缓存的键名列表（不含前缀部分）：

```ts
const allKeys = localStorageCacheStorage.keys()
// 返回: ['token', 'userInfo', 'theme', 'permissions']
```

## 序列化策略

内部使用 `JSON.stringify` / `JSON.parse` 进行序列化和反序列化：

### 存储的数据结构

每个缓存项在底层存储的完整结构为：

```json
{
  "value": "实际存储的值",
  "expire": 1717425600000,
  "createTime": 1717412000000
}
```

| 字段 | 说明 |
|------|------|
| `value` | 实际存储的值（经过 JSON 序列化） |
| `expire` | 过期时间戳（毫秒），0 表示永不过期 |
| `createTime` | 创建时间戳（毫秒） |

### Key 的处理

实际存储到 localStorage 中的 key 会自动添加前缀：

```ts
// 代码中写入
localStorageCacheStorage.setItem('token', 'abc123')

// 实际存储在 localStorage 中的 key 为：
// "app_cache_token"  (前缀_原key)

// 前缀来源：import.meta.env.VITE_APP_TITLE || 'app_cache'
```

这种设计的好处：
- 多个应用部署在同一域名下时不会互相干扰
- 清除缓存时可以精确控制范围

## 过期时间支持

### 设置过期时间

```ts
// 30 秒后过期
localStorageCacheStorage.setItem('code', '123456', 30)

// 5 分钟后过期
localStorageCacheStorage.setItem('tempData', data, 300)

// 1 天后过期 (86400 秒)
localStorageCacheStorage.setItem('cache', heavyData, 86400)
```

### 过期机制

- **惰性删除**：读取时检查是否过期，过期则返回 null 并删除
- **非主动扫描**：不会定时扫描所有 key（性能考虑）
- **精确到毫秒级**：使用 `Date.now()` 时间戳判断

```ts
// getItem 内部逻辑简化示意
const item = deserialize(dataStr)
if (item.expire > 0 && Date.now() > item.expire) {
  removeItem(key)      // 已过期，自动删除
  return null           // 返回 null
}
return item.value        // 未过期，返回值
```

## 使用 createCache 创建自定义实例

如果需要不同的配置（如不同的前缀、不加密、使用 sessionStorage 等）：

```ts
import { createCache } from '@/utils/cache'

// 创建 sessionStorage 版本的缓存
const sessionCache = createCache({
  type: 'session',
  prefix: 'my_app_session',
  encrypt: false,
})

// 创建内存缓存（页面刷新即丢失）
const memoryCache = createCache({
  type: 'memory',
  prefix: 'temp',
})

// 使用
sessionCache.setItem('tabState', { activeTab: 'home' })
memoryCache.setItem('formData', tempFormData, 300) // 5分钟过期
```

### CacheOptions 配置

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| `type` | 存储类型 | `'local' \| 'session' \| 'memory'` | `'local'` |
| `prefix` | 键名前缀 | `string` | 从环境变量获取 |
| `encrypt` | 是否加密存储 | `boolean` | `true` |

## 典型使用场景

### Token 管理

```ts
import { localStorageCacheStorage } from '@/utils/cache'
import type { UserInfo } from '@/types/user'

// 登录成功后存储
function onLoginSuccess(data: { token: string; user: UserInfo; expiresIn: number }) {
  localStorageCacheStorage.setItem('token', data.token, data.expiresIn)
  localStorageCacheStorage.setItem('userInfo', data.user)
}

// 请求时获取 token
function getAuthToken(): string | null {
  return localStorageCacheStorage.getItem<string>('token')
}

// 登出时清除
function onLogout() {
  localStorageCacheStorage.removeItem('token')
  localStorageCacheStorage.removeItem('userInfo')
  localStorageCacheStorage.clear() // 清除所有应用缓存
}

// 检查登录状态
function isLoggedIn(): boolean {
  return localStorageCacheStorage.hasItem('token') && localStorageCacheStorage.hasItem('userInfo')
}
```

### 主题/语言偏好持久化

```ts
// 保存用户偏好（永久存储）
localStorageCacheStorage.setItem('theme', 'dark')
localStorageCacheStorage.setItem('language', 'zh-CN')

// 读取偏好
const theme = localStorageCacheStorage.getItem<string>('theme') || 'light'
const lang = localStorageCacheStorage.getItem<string>('language') || 'zh-CN'
```

### 临时数据缓存（带过期）

```ts
// 验证码（5分钟过期）
localStorageCacheStorage.setItem('verifyCode', code, 300)

// 表单草稿（30分钟过期）
localStorageCacheStorage.setItem('draftForm', formData, 1800)

// 分页状态（10分钟过期）
localStorageCacheStorage.setItem('pageState', { page: 3, pageSize: 20 }, 600)
```
