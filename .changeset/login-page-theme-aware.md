---
"@antdv/web": patch
---

登录页改成跟随主题色与暗黑模式，并收成一条响应式布局。

登录页是全站唯一一个"用户带着偏好来看的第一屏"，但它原先有两处不认偏好：

1. **中性色只写了浅色一侧**（`bg-white/70`、`text-stone-800`、复选框上还钉了
   `[&_.ant-checkbox-inner]:!bg-white`）。明暗开关是 `@antdv/preferences` 写在 `<html>`
   上的 `dark` class，模板里一个 `dark:` 都没有，于是"整站深色、登录页还白着"，
   深色下那块被 `!important` 钉白的复选框尤其扎眼。
2. **强调色一半靠 `var(--ant-color-primary)` 内联样式**（logo、标题、分段选中态、
   发送验证码），一半靠 `!text-stone-500` 之类的覆盖把 link 按钮按回灰色；换主色时
   该亮的没亮、该灰的灰到底。

做法是把样式表整体重写为"强调色只用 `*-ant-primary` 工具类、中性色必须成对写
`dark:`、antd 能从主色派生的就不再自己画"：

- 输入框只保留高度与圆角两条覆盖，边框/底色/focus 光环交回 antd（它已经按
  `colorPrimary` 和 `darkAlgorithm` 派生好了，之前那些 `!bg-white!` 恰恰是把这条
  派生链掐断的地方）；复选框与「忘记密码」「发送验证码」同理，删掉覆盖就对了。
- 品牌区、装饰光斑、分段控件、主按钮全部走 `bg-ant-primary/10`、`text-ant-primary`
  这类工具类，内联 style 只剩 SVG。
- 顺手删掉一段靠 `[class*='group']:hover .w-11` 猜元素的 scoped 样式，换成
  `group-hover:scale-110`；窄屏（<lg）折叠成单列时补一行紧凑 logo，避免表单卡
  上面什么都没有。

**一个值得记住的运行时事实**：antdv-next 是开着 CSS 变量的，它把 `--ant-color-primary`
写在 `.ant-app` 上，作用域比偏好写在 `<html>` 上的那一份更近。浅色下两者相等所以看不出来，
深色下 antd 会按暗底把主色重算一档（`#FA541C` → `rgb(216, 74, 27)`），页面读到的是重算后的值。
因此端到端断言不能钉种子色值，改成钉"工具类与 antd 主按钮取到同一个主色、且已离开默认蓝"。

验证：
- `src/views/login/__tests__/login-styles.spec.ts` 5 条，断的是 composable 的不变量而不是
  具体类名 —— 强调色不许写死、出现浅色中性色就必须带 `dark:`；另有 1 条把 e2e 夹具依赖的
  占位符与「登录」文案钉住，防止改文案时静默弄红整套端到端。
- `e2e/login-page.spec.ts` 3 条 × chromium/firefox/webkit 全绿：登录后改偏好→清 token→
  **整页 reload**（只换 hash 不会重启应用，守卫会把 `/#/login` 弹回后台）再算样式；
  1440/390 两档的可见性 + 不出现横向溢出；手机登录里的链接色与主按钮底色同源。
