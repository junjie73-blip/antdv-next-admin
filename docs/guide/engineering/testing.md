# 测试指南

本项目使用 **Vitest** 进行单元测试，**Playwright** 进行 E2E 测试。完整的测试体系保障代码质量。

## Vitest 单元测试配置

### 配置文件 (vitest.config.ts)

```ts
import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import { defineConfig as defineViteConfig } from 'vite'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig as Parameters<typeof mergeConfig>[0],
  defineViteConfig({
    test: {
      environment: 'jsdom',                    // 使用 jsdom 模拟浏览器 DOM
      exclude: [...configDefaults.exclude, 'e2e/**'],  // 排除 E2E 测试
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
```

### 配置说明

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `environment` | `'jsdom'` | 测试运行环境，提供 `document`、`window` 等 API |
| `exclude` | `'e2e/**'` | 排除 E2E 测试目录 |
| `globals` | - | 是否暴露全局描述符（本项目未开启） |

### 运行命令

```bash
# 运行所有测试
pnpm run test:unit

# 监听模式（文件变更自动重跑）
pnpm run test:unit -- --watch

# 覆盖率报告
pnpm run test:unit -- --coverage

# 运行指定测试文件
pnpm run test:unit -- src/components/business/Form/__tests__/*.spec.ts

# 运行匹配名称的测试
pnpm run test:unit -- --reporter=verbose
```

## 测试文件命名规范

### 文件命名规则

测试文件必须匹配以下命名模式之一：

| 模式 | 示例 | 适用场景 |
|------|------|---------|
| `*.spec.ts` | `Form.spec.ts` | 单个组件/函数的测试 |
| `*.test.ts` | `helper.test.ts` | 工具函数的测试 |
| `__tests__/*.ts` | `__tests__/helper.spec.ts` | 集中放置的测试文件 |

### 推荐的目录结构

```
src/
├── components/
│   └── business/
│       ├── Form/
│       │   ├── BasicForm.vue
│       │   ├── useForm.ts
│       │   └── __tests__/          ← 组件测试集中存放
│       │       └── helper.spec.ts  ← 已有示例
│       └── Table/
│           └── hooks/
│               └── useDataSource.ts
├── utils/
│   ├── cn/
│   │   └── index.ts
│   │   └── index.spec.ts          ← 工具函数同目录测试
│   └── cache/
│       └── index.ts
└── views/
    └── ...
e2e/                              ← E2E 测试独立目录
    └── vue.spec.ts
```

## 常用断言方法

Vitest 内置 [Vitest Expect](https://vitest.dev/api/expect/)，兼容 Jest 断言语法：

### 基础断言

```ts
import { describe, it, expect } from 'vitest'

describe('基础断言', () => {
  it('相等性', () => {
    expect(1 + 1).toBe(2)              // 严格相等 (===)
    expect({ a: 1 }).toEqual({ a: 1 })  // 深度相等
    expect({ a: 1 }).toStrictEqual({ a: 1 }) // 深度相等（含类型）
  })

  it('真值判断', () => {
    expect(true).toBeTruthy()
    expect(false).toBeFalsy()
    expect(null).toBeNull()
    expect(undefined).toBeUndefined()
    expect(value).toBeDefined()         // 非 null 且非 undefined
  })

  it('数值比较', () => {
    expect(3.14).toBeGreaterThan(3)
    expect(3.14).toBeLessThan(4)
    expect(3.14).toBeCloseTo(3.14, 5)  // 浮点数近似比较
  })

  it('字符串匹配', () => {
    expect('hello world').toContain('hello')
    expect('hello').toMatch(/^hel/)
    expect('hello').toHaveLength(5)
  })

  it('数组/对象', () => {
    expect([1, 2, 3]).toContain(2)
    expect([1, 2, 3]).toHaveLength(3)
    expect(obj).toHaveProperty('name')
    expect(obj).toMatchObject({ name: '张三' })
  })

  it('异常', () => {
    expect(() => fn()).toThrow()
    expect(() => fn()).toThrow(Error)
    expect(() => fn()).toThrow('错误信息')
  })
})
```

### 异步断言

```ts
it('异步操作', async () => {
  // Promise
  const result = await fetchData()
  expect(result).toEqual({ success: true })

  // resolves / rejects
  await expect(fetchData()).resolves.toEqual({ data: [] })
  await expect(failingFn()).rejects.toThrow('错误')
})

it('回调中的异步', () =>
  new Promise((resolve) => {
    setTimeout(() => {
      expect(true).toBe(true)
      resolve(undefined)
    }, 100)
  }),
)
```

### DOM 断言（jsdom 环境）

```ts
import { mount } from '@vue/test-utils'

it('DOM 元素断言', () => {
  const wrapper = mount(MyComponent)

  expect(wrapper.find('.btn').exists()).toBe(true)
  expect(wrapper.findAll('li')).toHaveLength(3)
  expect(wrapper.text()).toContain('Hello')
  expect(wrapper.html()).toMatchSnapshot()
})
```

## 组件测试示例

### mount 与 shallowMount 的区别

| 方法 | 说明 | 渲染子组件 |
|------|------|-----------|
| `mount` | 完整渲染，包含子组件 | ✅ 真实渲染 |
| `shallowMount` | 浅渲染，子组件存根化 | ❌ 存根（stub） |

```ts
import { mount, shallowMount } from '@vue/test-utils'
import BasicForm from '@/components/business/Form/BasicForm.vue'

// 完整渲染 — 用于集成测试
const wrapper = mount(BasicForm, {
  props: {
    schemas: formSchemas,
  },
  global: {
    stubs: {
      // 可以选择性 stub 某些深层组件
      'a-modal': true,
    },
  },
})

// 浅渲染 — 用于单元测试（更快）
const wrapper = shallowMount(BasicForm, {
  props: {
    schemas: formSchemas,
  },
})
```

### Form 组件测试示例

参考项目中已有的 `src/components/business/Table/__tests__/helper.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
// 引入被测模块
import { formatDateFields, handleRangeValue, deepMerge } from '@/components/business/Form/helper'

describe('Form Helper', () => {
  describe('formatDateFields', () => {
    it('应该格式化日期字段为字符串', () => {
      const schemas = [
        { component: 'DatePicker', field: 'birthday', componentProps: { valueFormat: 'YYYY-MM-DD' } },
        { component: 'Input', field: 'name' },
      ]
      const values = {
        birthday: new Date('2024-01-15'),
        name: '张三',
      }
      const result = formatDateFields(values, schemas)

      expect(result.birthday).toBe('2024-01-15')
      expect(result.name).toBe('张三')
    })

    it('应该跳过非日期字段', () => {
      const schemas = [
        { component: 'Input', field: 'username' },
      ]
      const values = { username: 'admin' }
      const result = formatDateFields(values, schemas)

      expect(result.username).toBe('admin')
    })
  })

  describe('handleRangeValue', () => {
    it('应该将 RangePicker 值拆分为起始和结束字段', () => {
      const values = {
        dateRange: ['2024-01-01', '2024-12-31'],
      }
      const fieldMapToTime = [['dateRange', ['startDate', 'endDate']]]

      const result = handleRangeValue(values, fieldMapToTime)

      expect(result.startDate).toBe('2024-01-01')
      expect(result.endDate).toBe('2024-12-31')
      expect(result.dateRange).toBeUndefined()
    })
  })

  describe('deepMerge', () => {
    it('应该深度合并对象', () => {
      const target = { a: 1, b: { c: 2 } }
      const source = { b: { d: 3 }, e: 4 }

      const result = deepMerge(target, source)

      expect(result).toEqual({ a: 1, b: { c: 2, d: 3 }, e: 4 })
    })
  })
})
```

### Composable 测试示例

```ts
import { describe, it, expect } from 'vitest'
import { useForm } from '@/components/business/Form/useForm'

describe('useForm', () => {
  it('应该返回 register 和 methods', () => {
    const [register, methods] = useForm()

    expect(register).toBeTypeOf('function')
    expect(methods).toHaveProperty('getFieldsValue')
    expect(methods).toHaveProperty('setFieldsValue')
    expect(methods).toHaveProperty('resetFields')
    expect(methods).toHaveProperty('validate')
  })

  it('methods 在未注册时应安全调用', async () => {
    const [, methods] = useForm()

    // 未注册时返回空对象或默认值
    expect(methods.getFieldsValue()).toEqual({})
    await expect(methods.validate()).resolves.toEqual({})
  })
})
```

## Playwright E2E 测试配置

### 配置文件 (playwright.config.ts)

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,              // 单个测试超时 30 秒
  expect: { timeout: 5000 },      // expect 断言超时 5 秒
  forbidOnly: !!process.env.CI,  // CI 环境禁止 test.only
  retries: process.env.CI ? 2 : 0, // CI 失败自动重试 2 次
  workers: process.env.CI ? 1 : undefined, // CI 串行执行
  reporter: 'html',

  use: {
    actionTimeout: 0,             // 操作超时不限制
    baseURL: process.env.CI ? 'http://localhost:4173' : 'http://localhost:5173',
    trace: 'on-first-retry',     // 重试时录制 trace
    headless: !!process.env.CI, // CI 无头模式
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  webServer: {
    command: process.env.CI ? 'npm run preview' : 'npm run dev',
    port: process.env.CI ? 4173 : 5173,
    reuseExistingServer: !process.env.CI,
  },
})
```

### 配置要点

| 配置项 | 说明 |
|--------|------|
| `testDir` | E2E 测试文件目录：`./e2e` |
| `projects` | 浏览器矩阵：Chrome、Firefox、Safari |
| `webServer` | 自动启动开发服务器/预览服务器 |
| `reuseExistingServer` | 本地复用已启动的服务器 |
| `trace` | 失败重试时录制 trace 用于调试 |

### 运行命令

```bash
# 运行所有 E2E 测试
pnpm test:e2e

# 仅运行 Chrome
pnpm test:e2e --project=chromium

# UI 模式（可视化调试）
pnpm test:e2e --ui

# 生成测试报告
pnpm test:e2e --reporter=html
```

## 测试用例编写规范

### 单元测试规范

```ts
// ✅ 正确示范
describe('FunctionName', () => {
  it('should do something when condition is met', () => {
    // Given: 准备数据
    const input = { ... }

    // When: 执行操作
    const result = functionName(input)

    // Then: 验证结果
    expect(result).toEqual(expected)
  })

  it('should throw error when input is invalid', () => {
    expect(() => functionName(invalidInput)).toThrow()
  })
})

// ❌ 错误示范
describe('Test', () => {
  it('works', () => {            // 描述不清晰
    expect(fn()).toBeTruthy()     // 断言不精确
  })
})
```

### E2E 测试规范

```ts
// e2e/vue.spec.ts 参考项目已有示例
import { test, expect } from '@playwright/test'

test.describe('页面功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('应正确显示首页标题', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /antdv/i })).toBeVisible()
  })

  test('应能导航到登录页', async ({ page }) => {
    await page.click('text=登录')
    await expect(page).toHaveURL(/\/login/)
  })
})
```

### 编写原则

1. **AAA 模式**：每个测试遵循 Arrange（准备）→ Act（执行）→ Assert（验证）
2. **一个测试一个关注点**：每个 `it` 只验证一个行为
3. **描述即文档**：测试描述应清晰表达预期行为
4. **独立性**：测试之间不应有依赖关系
5. **快速反馈**：单元测试应在毫秒级完成

## CI 中测试执行

### GitHub Actions 示例

```yaml
name: Tests

on: [push, pull_request]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test:unit -- --coverage
      - uses: codecov/codecov-action@v4  # 上传覆盖率

  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
      - run: pnpm test:e2e
```

### 测试质量门禁建议

| 指标 | 建议阈值 |
|------|---------|
| 行覆盖率 | > 70% |
| 分支覆盖率 | > 60% |
| 新增代码覆盖率 | > 80% |
| 关键路径覆盖率 | 100% |
| E2E 核心流程通过率 | 100% |
