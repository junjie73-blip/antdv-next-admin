---
"@antdv/web": minor
"@antdv/shared": patch
"@antdv/directives": patch
---

feat: 组件示例按 vben 的分类补齐四页，并把示例里的 API 用错处一次性修掉

诉求：**"组件示例中可以参考 vben 的示例"**。范围按之前确认的口径收敛为
**"只做不引新依赖的一批"** —— 全部用本项目已有的 antdv-next / `@antdv/ui` /
`@antdv/directives` / `@antdv/shared`，不新增任何依赖。

## 新增的四页

| 路径 | 内容 |
| --- | --- |
| `/components/overview` | 卡片墙总览：清单**直接来自菜单**（不自己抄一份），可按名称/路径过滤，点卡片是真链接（走外壳标签页），无匹配给空状态 |
| `/components/feedback` | message / modal / popconfirm / notification / progress / result / watermark / alert |
| `/components/data-display` | descriptions / avatar / badge / segmented / tabs(editable-card + card) / collapse / timeline / steps / image / statistic / table |
| `/components/directive` | `v-permission` 判定矩阵 / `v-loading` 三种遮罩 / `v-lazy` 图片墙 / `v-safe-html` + `v-escape` |

菜单在 `apps/backend-mock/server/api/menus.get.ts` 里挂了「反馈与工具」这一组，
所以总览页与全站巡检都会自动带上新页，不需要改第二处。

## 示例页本身暴露出来的真 bug（都是"页面照样渲染、点了没反应"那一类）

1. **`import { useApp } from 'antdv-next'` 会让路由直接废掉**。1.6 的根导出是
   `_default as App`（`App.useApp` 挂在它上面），**没有具名的 `useApp`**：写成具名
   import 后 ESM 报 `does not provide an export named 'useApp'`，异步块加载失败 →
   导航中止，表现是"点了菜单没反应"，控制台之外没有任何提示。改成
   `const { message, modal, notification } = App.useApp()`。
2. **Notification 的标题字段是 `title`**，不是 React antd 那边的 `message`。
   写错不报错，只是标题整块空着。
3. **`<script setup>` 会把模板表达式里的 ref 自动解包**：`@click="flashLoading(boxLoading)"`
   传进函数的是 `false` 而不是 Ref，于是 `target.value = true` 抛
   `Cannot create property 'value' on boolean 'false'`，遮罩永远不出现。
   改成「键名 + 一个 `reactive` 记录」，并把这段坑写进页面注释（示例页是别人抄的模板）。
4. **`role` / `admin` 是参数（arg）不是修饰符**：`v-permission:role="'auditor'"`、
   `v-permission:admin` 才走角色与超管通道，写成 `.role` / `.admin` 判定根本不读。
   `@antdv/directives` 的 JSDoc 之前教的就是错的那一种，一并改了 —— 文档错比代码错传播得快。
   （`.all`、`.disabled` 才是真的修饰符。）
5. **`v-escape` 在 html 语境下做了二次转义**（`@antdv/shared`）：`textContent` 本身就不会
   把内容解析成 HTML，再跑一遍 `escapeHtml` 只会让用户看见 `&lt;script&gt;` 这种字面量。
   现在 html 语境直接落原文，其余语境（url/js/css/attr）仍按语义变换处理。
   注意 `packages/*` 是**从 `dist` 消费**的，改完 `src` 必须
   `pnpm --filter @antdv/shared build`，否则浏览器里跑的还是旧产物。
6. **Tabs 1.6 没有 `add` 事件**，只有 `edit(key | MouseEvent, 'add' | 'remove')`。
7. **三个不存在的图标名**被 `test/icon-names.test.ts` 抓出来（`carbon:voice`、
   `carbon:command`、`carbon:trend-up`）—— 这类错界面上只是"图标格子空白"，
   单测与巡检都看不见，靠这条对账才钉住。换成 `carbon:notification-new`、
   `carbon:terminal`、`carbon:arrow-up`。

## 顺带记下的 antdv-next 1.6 DOM 事实（写断言时踩过的）

- Timeline 是**拿 Steps 的 DOM 实现的**：每个 `.ant-timeline-item` 同时挂着
  `ant-steps-item`，所以页级 `.ant-steps-item` 数到 12 而不是 4，断言要圈进卡片。
- 线形进度条换成 `rail / track / indicator` 三段，旧的 `.ant-progress-bg` 没了；
  百分比在根节点的 `aria-valuenow` 上。
- `editable-card` 会渲染**两个** `.ant-tabs-nav-add`（常驻 + 溢出收纳区）。
- 切换后旧面板只是 `ant-tabs-content-hidden`，仍留在 DOM 里，取内容要用
  `[role=tabpanel][aria-hidden=false]`。
- message 的 wrapper 与 notice 两层都带 `ant-message-<type>`，按类名选会命中两个。
- 两个汉字的按钮可访问名会被写成「成 功」（中间插空格），`getByRole({ name: '成功',
  exact: true })` 选不中，e2e 用 `\s*` 容忍。

## 门禁

- 新增 `apps/web/e2e/gallery-examples.spec.ts`：13 条，覆盖四页的交互契约
  （总览过滤后点进去并激活标签页、message/modal/popconfirm 真的出现又消失、
  进度条真的在涨、子组件写法 `<a-descriptions-item>` / `<a-collapse-panel>` /
  `<a-timeline-item>` 的内容真的渲染出来 —— 组件解析失败只出 warning，表现为那块是空的、
  巡检看不出来）、权限矩阵逐格翻正、三种遮罩、懒加载 5/6 与坏地址回退、
  safe-html 四类载荷进不去而白名单能收窄、四页来回切不留脏状态。
- `site-sweep.spec.ts` 的**兜底页判定修掉一处假阳**：巡检靠"内容区文本里有没有
  `页面不存在`"抓死链接，而示例页正好把 404 的 `a-result` 当素材摆在 `a-card` 里，
  于是把好页面判成兜底页。改为**跳过卡片内的文字**（真兜底页是裸的 h1/p），
  并补一条正反两例的用例同时钉住假阴与假阳。

## 验证

- 单测：`pnpm test:unit` 21/21 任务、web 包 28 文件 / 258 条全绿
  （`packages/shared/__tests__/xss.test.ts` 跟着新口径改了断言）。
- 端到端（三引擎，`--workers=1`）：
  - chromium：`gallery-examples` 13/13，`site-sweep` 2/2。
  - firefox：`gallery-examples` 13/13，`site-sweep` 2/2。
  - webkit：`gallery-examples` 13/13；`site-sweep` 首跑把 `/system/user` 判红
    —— 现场快照停在上一个页面（实时监控大屏，它自己还在跑定时器），标签页始终没冒出来，
    也就是**导航还在路上而不是页面坏了**。巡检是"每页都能打开"的存在性检查，不是性能闸门，
    所以只给这个引擎放宽一档（每页预算 25s、激活等待 60s），Chromium / Firefox 保持
    15s / 20s，真退化仍然立刻红。放宽后 webkit 2/2 绿。
- 新增 `apps/web/src/views/__tests__/gallery-api-usage.spec.ts`：静态守卫三类"静默失效"的
  API 写法（具名 `useApp`、`v-*.role` / `v-*.admin` 修饰符、`<a-tabs @add>`），
  每条规则都配"必须命中"与"不许误伤"两组样例 —— 只断言 0 命中的守卫，正则写错时同样是
  0 命中，会静默变成一条永远绿的空检查。
- Lint：改动的页面、包源码与两份 spec `eslint` 干净。
- 未处理：`pnpm type-check` 仍有 **253 条存量错误**（`components/business/**`、
  `api/mock.ts`、`security/dashboard/**` 等，均非本批文件；本批四个页面与 spec 零错误）。
  是否把它纳入 CI 门禁，等 #54 那条一起定。
