---
"@antdv/web": patch
---

fix: 交互巡检第二轮 —— 把"看起来能用、实际点不动"的一批缺陷清掉

上一轮巡检看的是"页面有没有坏"，这一轮逐个点开抽屉、弹窗、气泡确认，验证的是**点下去到底有没有结果**。
挖出来的问题里大半是全站性的：修一处，所有页面一起好。

- **弹窗里的表单回填一直是空的**：`BasicModal` 默认 `destroyOnHidden`，表单每次开弹窗都是新实例；
  而 `useForm` 持有的 `formRef` 在组件卸载后并不会变成 `null`。于是全站通行的
  "先 `setFieldsValue` 再 `openModal`"写法把值写进了一个已经死掉的实例 —— 不报错、不提示，
  编辑弹窗打开就是空白，用户改无可改。现在 `FormActionType` 多一个 `isMounted()` 契约，
  `useForm` 认这个契约：实例是死的就把值暂存进待写入队列，`@register` 拿到活实例时一次性兑现。
  一处改动覆盖全站 20+ 个调用点，配 7 条单测把契约钉住。
- **搜索条件存不住**：`useDataSource` 只在提交那一次用到 `searchInfo`，之后任何一次不带条件的取数
  —— 保存/删除后业务页惯常调的 `reload()`、点分页翻页 —— 都会静默退回"全量第一页"。
  表现是"搜到某一行改完保存，那条记录凭空消失"，看起来像编辑没生效。
  现在最近一次生效的条件由 hook 记住，重置表单时同步清掉；5 条单测分别盯 reload、翻页、覆盖、清空。
- **固定列里的确认气泡点不下去**：全局 `getPopupContainer` 把弹层挂到触点的父节点（为了跟随内层滚动容器），
  但表格固定列的 `<td>` 是 `position: sticky`，sticky 一律自成一个层叠上下文 ——
  挂进去的气泡 z-index 只在这个上下文里比大小，被隔壁单元格的 sticky 阴影整块盖住。
  操作列落在固定列里时把落点退回 `document.body`。
- **antd 自带文案全是英文**：`loadLocale` 早就写好了，调用点在 `App.vue` 里被注释掉过，
  于是分页的「条/页」、日期选择器的「开始日期」一直是英文。接回来，语言切换与 dayjs 同步。
- **图片墙点不出预览**：三层原因叠在一起 —— 新选的本地图片没有 `url`（antd 给的是 blob `thumbUrl`）、
  服务端地址挂在信封 `response.data.url` 里、`listType="picture-card"` 的缩略图本体是个
  `<a target="_blank">`（`@preview` 只是额外回调，它不 `preventDefault`，点一下会另开标签页）；
  再加上 `.ant-upload-list-item-actions` 那条绝对定位、撑满整格的图标条把点击整个吃掉。
  预览地址统一走一个解析函数，事件里吃掉原生跳转，卡片内遮罩与图标条改为穿透（图标自身仍可点）。
  头像框此前按"数组有没有长度"判断渲染哪一面，文件刚进列表还没地址的那一瞬两边都不渲染，头像整个消失，改成只看有没有地址。
- **每张表的"下一页"其实还是第一页**：`BasicTable` 发的是 `pageNum`（与 `pageSize` 成对），
  而 mock 的 10 个列表 handler 沿用了 legacy 的 `query.page`。两边各自都"对"，唯独对不上：
  翻页控件能点、请求会发、状态码 200，界面上一行都不换。handler 改成 `pageNum ?? page` 两种都认，
  并在 `test/api-parity.test.ts` 加一组静态对账 —— 新增列表接口若只读 `query.page` 当场变红。
  这个错前后端单测都抓不到：前端只断言"我把 pageNum 发出去了"，后端只断言"给我 page 我能切片"，
  所以 `ops-sweep` 里那条分页用例也从"URL 里有没有 pageNum"升级成"翻页之后首行内容必须真的变了"。
- **删除这种不可逆操作没有二次确认**：用户管理点一下就直接删；菜单管理更狠，删目录等于连子树一起删，
  而提示只报一个菜单名。现在两处都走确认气泡，菜单的文案与结果提示都把"连带多少个子项"说清楚。
  组件示例里的操作树是反过来的问题 —— 按钮只弹一句"删除节点: xxx"、节点原地不动，
  演示页给了反馈不给结果，现在真的摘掉节点，并按子树大小给确认文案。
- **视频演示页在没能力的浏览器上摆黑框**：`/components/video` 的 HLS 卡片无论环境能不能播都照挂播放器，
  放不出来时用户看到的是一句英文厂商标案 "No compatible source was found for this media."。
  实测三种引擎的差别：Chromium 原生 `canPlayType('…mpegurl')` 给 `maybe` 且 `MediaSource.isTypeSupported` 可用；
  Firefox 靠 MSE；而 **Playwright 自带的 WebKit 构建里 `window.MediaSource` 整个不存在**（它的 mp4 反而是支持的），
  这条卡片必然报错 —— 巡检被它咬红，真实用户看到黑框。
  现在挂之前先探测（原生 m3u8 / `MediaSource.isTypeSupported` / 旧前缀名 / `ManagedMediaSource`），
  放不出来就换成中文说明并说明"换哪个浏览器能看到效果"，另外两张 MP4 卡片照常挂；
  真到了运行期才失败（断网、CDN 挂了）也有 `@error` 兜底给单独一条说明，不连带误伤别的卡片。
  `notSupportedMessage` 一并换成中文。探测逻辑抽成 `media-capability.ts`，配 8 条单测 ——
  ⚠️ 标准方法是 `isTypeSupported`，写成 `isSupportedType` 不报错但恒为假，会把 Chrome 上的 HLS 卡片整块藏掉。
- **通知管理页的编辑是死代码**：弹窗标题写着 `isEditing ? '编辑消息' : '新增消息'`，

  但没有任何入口把 `isEditing` 置真，`editingNoticeId` 也一起是死的；保存时不带主键，
  `/system/notice/save` 永远当新增处理。补上编辑按钮、回填与带 id 的提交。
- **顶栏通知小部件复活**：铃铛此前挂在偏好里但从不渲染。现在按 `widgetNotice` 开关出现，
  下拉里读的是真实未读列表，单条已读/全部已读跳接口，跳「消息通知」页走路由；
  mock 侧补 `notice/save` 与整套 `upload` 接口（分片上传、秒传命中、合并校验）。

`e2e/ops-sweep.spec.ts` 从 12 条增至 18 条，把"能不能真的操作"写成断言：
图片墙预览（点本体不另开标签、Esc 之后还能二次打开）、用户/通知/消息的增改删闭环、
删除确认的取消分支（点了取消却删掉等于没加确认）、菜单连带子树的删除、
顶栏主题与全屏、以及搜索条件在保存后仍在（新增用例直接盯本次修复）。
夹具全部带时间戳 —— mock 的库存在进程内存里，上一轮失败留下的同名数据会把下一轮误判成"没删干净"。
该轮收尾时 Chromium 全量端到端与仓库单测全绿（全站条数会随后续几轮变化，以最新一条 changeset 的口径为准）。
