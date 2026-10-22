# 交付验收标准与上线前检查清单

交付的定义（用户长期口径）：**单元测试 + 浏览器端到端验证 + 收尾清理，做到绿了再汇报**。
"我改完了"不是交付；"证据齐了、旧的没了、绿的能复现"才是。

## 1. 验收标准（什么算绿）

| 维度 | 通过条件 | 取证方式 |
| --- | --- | --- |
| 功能 | 用户可见行为在真实浏览器里发生，且是"点了有事"而不是"渲染出来了" | e2e 断言到具体文本/几何/状态，不只看 `toBeVisible()` |
| 回归 | 相关 spec 在三引擎（chromium/firefox/webkit）全绿 | 每个引擎一条 `EXIT=0` 的日志尾部截图/文本 |
| 类型 | `turbo run type-check` 无新增错误（存量约 90 条属 `@antdv/web`，点名即可） | 命令输出 |
| 单测 | `turbo run test:unit --concurrency=1` 全绿；红用例单文件复跑确认过 | 命令输出 + 复跑输出 |
| 静态约束 | 体检脚本 `EXIT=0`；`pnpm check:builds`、`check:dep`、`check:circular` 通过 | 命令输出 |
| 产物 | `pnpm build:web` 成功，`verify-prod-mock.mjs` 无请求逃逸到网络 | 两个命令输出 |
| 文档 | 变更涉及的规范/README/docs 同批更新 | diff 里能看到 |
| 变更声明 | 每个用户可见变更一条 `.changeset/*.md`，写清"改了什么 + 为什么 + 怎么验证" | 文件存在且内容与实测数字一致 |

## 2. 功能校验要求（每项都要在浏览器里做一遍）

- **入口链路**：登录 → 首屏遮罩消失 → 菜单加载 → 目标页渲染 → 关键操作出结果。首屏 Loading、主题回填（`script[data-app-loading-theme-sync]`）这类"挂载前就发生"的行为要用**新标签冷启动**验，不能只用 HMR 后的热态。
- **双向/受控**：v-model 类组件要验"外部改值会回灌"和"内部改动会发出"，两个方向分别断言。
- **状态矩阵**：空 / 加载 / 错误 / 边界数据（超长文本、0 条、超大分页）/ 禁用 / 只读，每个组件至少覆盖到实际用到的档；`Empty`、`Spinner` 的可见性要有断言。
- **浮层四件套**：Select、Popover、DropdownMenu、Modal/Drawer 各验一次"贴着触发器 + 有底色 + 有投影 + z-index 生效 + 不超出视口"（`popup-anchor.spec.ts` 已把这条固化）。
- **交互即语义**：可点盒子必须指针光标、禁用必须 `not-allowed`；有 hover 反馈但没有 click 的盒子要登记进装饰性白名单并说明理由。
- **深浅色 + 预设**：至少切一次深色、切一次非默认主色预设，确认没有"两种橙"（两条主色链路混用）。
- **窄屏**：360/390/767 三档 + 768 回归；抽屉/遮罩/悬浮簇不溢出、不重叠。
- **控制台**：跑完一轮目标流程后 `errors` 为空（外站资源失败按分桶豁免，本站错误不豁免）。
- **权限**：`v-permission` 的 arg 写法与降级样式都要验一次"无权限时确实降级"。

## 3. 收尾清理（交付前自查，缺一项算没做完）

1. 临时探针删除：`apps/web/e2e/tmp-*.spec.ts`、`*.log`、`docs/_sidebarcheck.mjs` 这类一次性脚本。
2. 旧路径零残留：被迁移/删除的组件、composable、样式类，`Grep` 全仓（含 docs 与 `.changeset`）确认 0 命中。
3. `git status` 干净且只含本次改动：不要夹带别人的在制品；看到不认识的改动先问，不要顺手提交。
4. lockfile 与 catalog 一致；无 `console.log` 调试语句、无被注释掉的旧实现、无 `any` 兜底遗留。
5. `.turbo`、`dist`、`test-results`、`playwright-report` 属忽略产物，不需要入库；根目录不产新垃圾。
6. 数字要更新：changeset/文档里写的"通过 N 条"必须是本轮实测值，不沿用上一轮。

## 4. 上线前检查清单

**工程**
- [ ] `pnpm check`（circular + dep + type + builds + cspell）通过或有点名例外
- [ ] `pnpm build:web` 绿，产物体积与上一版无异常增长（必要时 `VITE_VISUALIZER` 看一次）
- [ ] `node apps/web/scripts/verify-prod-mock.mjs` 无请求逃逸（若接真实后端，改为关掉 `VITE_MOCK` 并对手工接口清单）
- [ ] 三引擎 e2e 全绿，日志留档
- [ ] `.env.production` 与部署环境一致：`VITE_APP_BASE_API`、`VITE_MOCK`、`VITE_WS_URL`、`VITE_PWA`、`VITE_COMPRESS`

**配置与安全**
- [ ] `VITE_CACHE_ENCRYPT_KEY` 换成部署方自己的随机 32 字符值（仓库示例值必须替换）
- [ ] Sentry DSN 由环境注入，且已知 Session Replay 属于个人信息处理（需告知/开关）；`tracePropagationTargets` 里不含写死的外部 IP
- [ ] 无凭据进源码/日志/提交信息；token 只进 SM4 加密缓存，不拼 URL、不进 `localStorage`
- [ ] CSRF 现状按实说明（当前前端生成 token 不构成有效防护，需后端下发）
- [ ] 第三方依赖许可核对完成（`references/third-party.md` §6），copyleft 与来源不明包不进产物

**兼容**
- [ ] 浏览器矩阵：Chromium / Firefox / WebKit + 目标最低版本；窄屏 360/390/767；深浅色；主色预设切换
- [ ] 浮层在矮视口不溢出视口；长文本/超长标签不撑破布局
- [ ] `@source` 名单与实际带 `.vue` 的包一致（新包上线前重点核对：漏登记是静默变样，构建不报错）

**交付物**
- [ ] changeset 已写、版本号策略确认（`private: true`，版本只服务变更记录）
- [ ] 文档站可构建（`pnpm docs:build`），受影响的指南页已更新
- [ ] 回滚路径明确：出问题时知道回退哪一个提交/镜像标签，容器入口与静态资源缓存策略（nginx）确认过

## 5. 汇报格式

一次性给出：改了什么（文件级）→ 为什么这么做 → **证据**（各命令 `EXIT=` 与用例数）→ 已知例外/未覆盖项 → 下一步建议。
不许在没跑三引擎 e2e 时说"应该没问题"；不许用后台包装器的 exit code 当结论。
