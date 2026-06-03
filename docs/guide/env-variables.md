# 环境变量

## 变量列表

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `VITE_APP_TITLE` | string | Antdv Next Vue Admin | 项目标题（显示在浏览器标签页） |
| `VITE_PORT` | number | 9080 | 开发服务器端口 |
| `VITE_APP_BASE_API` | string | - | API 基础路径（生产环境使用） |
| `VITE_MOCK` | boolean \| string | true | 是否启用 Mock 数据 |
| `VITE_DEVTOOLS` | boolean | - | 是否启用 Vue DevTools |
| `VITE_PWA` | boolean | - | 是否启用 PWA |
| `VITE_VISUALIZER` | boolean | - | 是否启用构建分析可视化 |
| `VITE_COMPRESS` | string | - | 压缩格式：gzip / brotli |
| `VITE_ARCHIVER` | boolean | - | 是否启用打包归档 |
| `VITE_MICRO_APP` | boolean | - | 是否启用微前端功能 |

## 配置文件

项目包含三个环境配置文件：

### `.env` — 公共变量

```bash
# 应用标题
VITE_APP_TITLE=Antdv Next Vue Admin

# Mock 数据开关
VITE_MOCK=true
```

### `.env.development` — 开发环境

```env
# 开发环境启用 DevTools
VITE_DEVTOOLS=true

# 启用构建分析
VITE_VISUALIZER=true
```

### `.env.production` — 生产环境

```bash
# 生产环境压缩格式
VITE_COMPRESS=gzip

# 启用打包归档
VITE_ARCHIVER=true

# 启用 PWA
VITE_PWA=true
```

## 使用方式

在代码中使用环境变量：

```ts
const appTitle = import.meta.env.VITE_APP_TITLE
const isMock = import.meta.env.VITE_MOCK === 'true'
```

> **注意**：只有以 `VITE_` 开头的变量才会暴露给客户端代码。
