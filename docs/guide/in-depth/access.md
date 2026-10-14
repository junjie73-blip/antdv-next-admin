# 权限、指令与光标

## 三层权限

| 层 | 谁负责 | 失败表现 |
| --- | --- | --- |
| 路由 | `@antdv/router` 的守卫：登录校验 + 按权限过滤菜单/路由 | 跳登录页，或落 `/error/403` / `/error/404` |
| 菜单 | 后端菜单接口只返回有权项，前端不再自己猜 | 菜单里根本不出现 |
| 元素 | `v-permission`（`@antdv/directives`） | 默认 `display: none`，或 `.disabled` 降级 |

::: tip 兜底页不该进标签页 `/error/403`、`/error/404` 在菜单里标 `hidden`，也不参与标签页注册 —— 用户点开一次错误页不该在标签栏留一枚"404"。全站巡检判断"落到兜底页"靠的是地址（`toHaveURL(/#\/error\/404/)`），不是标签激活状态。:::

## 越权落 403 还是 404（不是写死的）

按菜单裁剪注册表之后，**没权限的页面路由压根没注册**，导航只能落到通配兜底（`apps/web/src/router/routes.ts:60-82`）。可那是"没权限"，不是"没这个页面"，统一报 404等于告诉用户"没这个功能"，他会去打错的地方找而不是去找管理员开权限。所以分流放在 `catchAllRoute.redirect` 里现算：

```ts
redirect: (to) =>
  useRouteStore().isUngrantedExistingPage(to.path) ? '/error/403' : '/error/404',
```

`isUngrantedExistingPage`（`apps/web/src/stores/modules/route.ts:370-375`）拿全量菜单快照里的 **叶子落点**（`collectExistingPagePaths`，已剔掉框架页）比对当前地址：页面存在而未授权 → 403，和守卫的 `forbiddenPath` 同一个落点，两种拦法表现一致；真的没这个地址 → 404。判据取"叶子" 而不是"有没有 `component` 字段"—— 约定路由生成的页面记录在快照里未必带该字段，按字段筛会把好端端的页面筛成"不存在"，越权访问就又退回 404 了。

`apps/web/e2e/permission-accounts.spec.ts` 用 `admin` / `custom` 两个账号把这条链钉住：白名单页都能进、名单外的页一律落 `/#/error/403`，并反向对照一次 —— 乱敲的地址（`/components/this-page-does-not-exist`）必须还是 404，否则"没权限"和"打错了"被写成同一个落点没人发现。按钮级的那条不对称放在 `apps/web/e2e/table-crud.spec.ts`：同一张表，admin 看得见「删除 / 批量删除」，custom 只给了 `add`/`edit`，整页找不到任何删除入口。

## `v-permission` 的写法（arg 与 modifier 别混）

判定优先级来自 `packages/directives/src/permission/utils.ts`： `arg === 'admin'` → 超管；`'*'` 权限码 → 全通；`arg === 'role'` → 按角色解释；否则按权限码。

```vue
<!-- 按权限码（默认解释方式），"或"关系 -->
<a-button v-permission="'system:user:add'">新增</a-button>
<a-button v-permission="['system:user:edit', 'system:user:add']">编辑</a-button>

<!-- 要求同时具备 → .all -->
<a-button v-permission="['a', 'b'].all">两个都要</a-button>

<!-- 按角色：role 是**参数 arg** -->
<a-button v-permission:role="'auditor'">审计员可见</a-button>

<!-- 超管：同样是一个 arg，值为空 -->
<a-button v-permission:admin>管理员可见</a-button>

<!-- 不隐藏，改成禁用降级 -->
<a-button v-permission.disabled="'system:user:delete'">删除</a-button>
```

::: danger `role` / `admin` 是参数，不是修饰符写成 `v-permission.role="'auditor'"` 或 `v-permission.admin`，判定**根本不读**，元素永远可见 —— 不报错、不警告，是最难发现的一类权限漏洞。（真正的修饰符只有 `.all` 和 `.disabled`。） `apps/web/src/views/__tests__/gallery-api-usage.spec.ts` 里有一条静态守卫专门抓这种写法，并配了"必须命中 / 不许误伤"两组样例，防止规则本身写空。:::

对象写法可以自带口径，此时 `arg` 不再参与解释：

```vue
<a-button
  v-permission="{ mode: 'all', permissions: ['a', 'b'], roles: ['ops'] }"
>
  混合判定
</a-button>
```

## 指令包不碰 store

`@antdv/directives` 包内不 import pinia / api / vueuse，判定函数、订阅、开发期日志全靠注入：

```ts
// apps/web/src/directives/index.ts
export const vPermission = createPermissionDirective({
  // 惰性取 store：本模块在 main.ts 被 import 时 pinia 还没挂上，
  // 直接 usePermission() 会抛 no active pinia
  checkers: () => usePermission(),
  onCheck: (context) => {
    if (import.meta.env.DEV) console.log('[v-permission]', context);
  },
  // 权限列表是登录后异步回填的，订阅它元素才会在数据到位后自己翻正
  subscribe: (notify) =>
    watch(() => useUserStore().permissions, notify, { deep: true }),
});
```

`subscribe` 是关键那条：没有它，**先渲染后拿权限**的按钮会永远停在"看不见"。返回的 stop 函数由指令在 `unmounted` 时调用，不留悬垂 `watch`。

## 降级样式归样式层

指令只"打标记"（`.disabled` 修饰符下叠 `permission-disabled`，默认直接 `display:none`），视觉由 `@antdv/design/css/permission.css` 决定：

```css
.permission-disabled {
  @apply cursor-not-allowed opacity-50 saturate-50 select-none;
  pointer-events: none; /* 非表单元素不认 disabled 属性，这里统一挡掉交互 */
}
```

写在 `@layer components` 里，所以模板上的工具类仍能覆盖 —— 想"无权限也保持不透明"，加 `opacity-100`；想"看着降级但还能交互"，加 `permission-disabled--passthrough`。不用改指令。

## 光标规则：可点才 pointer

统一口径是**只有真的能触发交互的元素才 `cursor-pointer`**：可点的卡片、按钮、链接、标签页、树节点、开关都有；禁用态给 `cursor-not-allowed`；纯展示容器与文本保持默认光标。"hover 的盒子都该带 cursor"如果做成无差别 `:hover { cursor: pointer }`，会把不可点的区域也骗成可点 —— 那是可用性倒退，所以按"能不能点"分类，而不是按"有没有 hover 样式"。

## 另外四个安全/体验指令

```ts
// apps/web/src/main.ts
app.directive('safe-html', safeHtmlDirective); // 富文本白名单渲染
app.directive('escape', escapeDirective); // 按语境转义
app.directive('lazy', vLazy); // 进视口才加载
app.directive('loading', vLoading); // 元素遮罩 + 全屏实例
```

`v-safe-html` / `v-escape` 来自 `@antdv/shared/utils/xss`。两条已经踩过的坑：

1. **`v-escape` 在 html 语境下不要再二次转义**。`textContent` 本来就不会把内容解析成 HTML，再跑一遍 `escapeHtml` 只会让用户看见 `&lt;script&gt;` 这种字面量。现在 html 语境直接落原文，其余语境（`url` / `js` / `css` / `attr`）按各自语义变换： `v-escape:url` 会把 `javascript:` 这类伪协议换成 `#unsafe-url`。
2. **`<script setup>` 会把模板表达式里的 ref 自动解包**。`@click="flashLoading(boxLoading)"` 传进函数的是 `false` 而不是 `Ref`，于是 `target.value = true` 抛 `Cannot create property 'value' on boolean 'false'`，遮罩永远不出现。要按"键名 + 一个 `reactive` 记录"传，别把 ref 直接当参数递。
