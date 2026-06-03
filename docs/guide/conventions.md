# 开发规范

## 代码风格

### 命名约定

| 类型 | 规范 | 示例 |
|------|------|------|
| 类名 | 大驼峰 (PascalCase) | `UserService` |
| 函数名 | 小驼峰 (camelCase) | `getUserList` |
| 变量名 | 小驼峰 (camelCase) | `isLoading` |
| 常量名 | 全大写蛇形 (UPPER_SNAKE_CASE) | `MAX_RETRY_COUNT` |
| 枚举成员 | 大驼峰 (PascalCase) | `StatusActive` |
| 文件名 | 小驼峰或短横线 (kebab-case) | `useTable.ts`, `user-service.ts` |

### Vue 组件规范

```vue
<script setup lang="ts">
// ✅ 使用 <script setup lang="ts">
// ✅ 需要 TSX 时使用 lang="tsx"
import { ref, computed } from 'vue'
import { cn } from '@/utils/cn'

// 样式类名在 script 中定义，禁止写在模板中
const cardClassName = cn(
  'p-4 rounded-lg',
  'bg-white dark:bg-gray-800',
)
</script>

<template>
  <!-- ✅ 使用 :class 绑定变量 -->
  <div :class="cardClassName">
    内容
  </div>

  <!-- ❌ 禁止在模板中直接写 Tailwind 类名 -->
  <!-- <div class="p-4 rounded-lg bg-white"> </div> -->
</template>
```

### 禁止事项

| 禁止项 | 替代方案 |
|--------|----------|
| 模板中写 Tailwind 类名 | 使用 `cn()` 在 script 中定义 |
| 直接使用 `localStorage` | 使用 `localStorageCacheStorage` |
| 使用 Antdv Next 的 Drawer/Modal | 使用项目的 `BasicDrawer` / `BasicModal` |
| 手动导入自动导入的组件 | 直接在模板中使用 |
| 使用 `typeof` 判断类型 | 使用 `es-toolkit` 的类型检查函数 |
| 使用 `document.querySelector` | 使用 `useTemplateRef` |

## Git 提交规范

遵循 [Angular 提交规范](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复问题 |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构（非新功能、非修复） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具/依赖变更 |

### 示例

```bash
feat(log): 添加操作日志模块

fix(online): 修复强制下线后状态不更新的问题

docs(readme): 更新技术栈版本号
```

## 依赖管理

### 安装新依赖

```bash
# 必须使用 bun
bun add package-name

# 开发依赖
bun add -D package-name
```

### 安全审计

每次引入新依赖后必须执行审计：

```bash
bun audit package-name
```
