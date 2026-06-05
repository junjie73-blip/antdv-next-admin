# 快速开始

## 环境要求

- **Node.js** ^20.19.0 || >=22.12.0
- **pnpm**（推荐）或 npm / yarn / pnpm
- **Git**

## 安装

```bash
# 克隆仓库
git clone https://github.com/junjie73-blip/antdv-next-admin.git

# 进入项目目录
cd antdv-next-admin

# 安装依赖（使用 pnpm）
pnpm install

# 或使用其他包管理器
npm install
yarn install
```

## 启动开发服务器

```bash
pnpm dev
```

启动后访问 `http://localhost:9080`

> 默认账号：`admin` / 密码：`admin123`

## 构建生产版本

```bash
pnpm run build
```

构建产物输出到 `dist/` 目录。

## 预览生产构建

```bash
pnpm run preview
```

## 目录速览

首次接触项目时，建议按以下顺序了解：

1. [目录结构](/guide/directory-structure) — 了解项目文件组织
2. [开发规范](/guide/conventions) — 掌握编码约定
3. [环境变量](/guide/env-variables) — 配置项目参数
4. [组件文档](/components/table) — 学习业务组件使用

## 常见问题

### 端口被占用？

Vite 会自动尝试下一个可用端口（9080 → 9081 → 9082 ...）

### Mock 数据不生效？

确保 `.env` 文件中 `VITE_MOCK=true`（默认开启）

### 样式不生效？

检查是否使用了 `cn()` 函数生成类名，禁止在模板中直接写 Tailwind 类名。

```vue
<!-- ✅ 正确 -->
<script setup>
import { cn } from '@/utils/cn'
const className = cn('bg-red-500', 'text-white')
</script>
<template>
  <div :class="className">内容</div>
</template>

<!-- ❌ 错误 -->
<template>
  <div class="bg-red-500 text-white">内容</div>
</template>
```
