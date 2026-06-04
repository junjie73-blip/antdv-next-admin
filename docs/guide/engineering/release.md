# 版本发布

本项目使用 [standard-version](https://github.com/conventional-changelog/standard-version) 自动化版本管理，基于 **Angular 提交规范** 生成 CHANGELOG 和 Git Tag。

## standard-version 工具配置

### .versionrc.json 配置文件

```json
{
  "types": [
    { "type": "feat", "section": "🚀 Features" },
    { "type": "fix", "section": "🐛 Bug Fixes" },
    { "type": "docs", "section": "📝 Documentation" },
    { "type": "style", "section": "💅 Styles" },
    { "type": "refactor", "section": "♻️ Code Refactoring" },
    { "type": "perf", "section": "⚡ Performance" },
    { "type": "test", "section": "🧪 Tests", "hidden": true },
    { "type": "chore", "section": "🔧 Chores", "hidden": true },
    { "type": "ci", "section": "🔄 CI/CD", "hidden": true },
    { "type": "build", "section": "📦 Build", "hidden": true }
  ],
  "commitUrlFormat": "https://github.com/your-repo/antdv-next-admin/commits/{{hash}}",
  "compareUrlFormat": "https://github.com/your-repo/antdv-next-admin/compare/{{previousTag}}...{{currentTag}}",
  "issueUrlFormat": "https://github.com/your-repo/antdv-next-admin/issues/{{id}}",
  "releaseCommitMessageFormat": "chore(release): {{currentTag}}",
  "skip": {
    "tag": true,
    "commit": false
  }
}
```

### 类型与 CHANGELOG 分区说明

| commit type | CHANGELOG 分区 | 是否显示 | 说明 |
|-------------|---------------|---------|------|
| `feat` | 🚀 Features | ✅ 显示 | 新功能 |
| `fix` | 🐛 Bug Fixes | ✅ 显示 | 问题修复 |
| `docs` | 📝 Documentation | ✅ 显示 | 文档更新 |
| `style` | 💅 Styles | ✅ 显示 | 样式调整（不影响代码逻辑） |
| `refactor` | ♻️ Code Refactoring | ✅ 显示 | 重构（非新功能、非修复） |
| `perf` | ⚡ Performance | ✅ 显示 | 性能优化 |
| `test` | 🧪 Tests | ❌ 隐藏 | 测试相关 |
| `chore` | 🔧 Chores | ❌ 隐藏 | 构建/工具链变更 |
| `ci` | 🔄 CI/CD | ❌ 隐藏 | CI 配置变更 |
| `build` | 📦 Build | ❌ 隐藏 | 构建系统变更 |

### skip 配置说明

```json
"skip": {
  "tag": true,      // 跳过自动创建 Git Tag（手动管理）
  "commit": false   // 不跳过自动提交（会生成 release commit）
}
```

- `tag: true`：standard-version 只更新版本号和 CHANGELOG，不创建 Git Tag。Tag 由发布者手动创建并推送。
- `commit: false`：standard-version 会自动生成一个 `chore(release): x.y.z` 的 commit。

## 发布命令

在 `package.json` 中预定义了以下发布脚本：

```json
{
  "scripts": {
    "release": "standard-version",
    "release:first": "standard-version --first-release",
    "release:minor": "standard-version --release-as minor",
    "release:major": "standard-version --release-as major",
    "release:patch": "standard-version --release-as patch"
  }
}
```

### 命令详解

#### `pnpm run release` — 自动版本升级

根据 commit 类型自动决定版本号升级幅度：

```
存在 feat 类型的 commit → 升级 MINOR 版本 (x.Y+1.z)
仅存在 fix 类型的 commit → 升级 PATCH 版本 (x.y.Z+1)
其他情况 → 不升级（或按 PATCH 处理）
```

**执行流程：**
1. 分析上次 tag 之后的所有 commits
2. 根据类型确定新版本号
3. 更新 `package.json` 中的 version 字段
4. 生成/更新 `CHANGELOG.md`
5. 创建 release commit

**适用场景：** 日常迭代发布

---

#### `pnpm run release:first` — 首次发布

用于项目首次发布，从 `0.0.0` 开始：

```bash
pnpm run release:first
# 输出: 1.0.0 (首个正式版本)
```

**适用场景：** 项目首次对外发布

---

#### `pnpm run release:minor` — 次版本发布

强制升级次版本号：

```bash
# 当前版本: 1.2.3
pnpm run release:minor
# 新版本: 1.3.0

# 无论 commit 中是否有 feat，都会升级 MINOR 位
```

**适用场景：** 新增功能特性、API 变更

---

#### `pnpm run release:major` — 主版本发布

强制升级主版本号：

```bash
# 当前版本: 1.2.3
pnpm run release:major
# 新版本: 2.0.0

# 表示有不兼容的重大变更
```

**适用场景：** 破坏性 API 变更、架构重构、依赖大版本升级

---

#### `pnpm run release:patch` — 补丁版本发布

仅升级补丁号：

```bash
# 当前版本: 1.2.3
pnpm run release:patch
# 新版本: 1.2.4

# 仅包含 bug 修复
```

**适用场景：** 紧急热修复、小问题修复

## Angular 提交规范与 CHANGELOG 关系

### Commit Message 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

**完整示例：**

```
feat(table): 支持拖拽排序功能

- 新增 useDragSort composable
- 支持 drag-handle 模式和整行拖拽模式
- 拖拽完成后自动调用排序接口

Closes #123
```

### Type 列表

| Type | 说明 | 触发版本升级 |
|------|------|------------|
| `feat` | 新功能 | MINOR (或 MAJOR) |
| `fix` | 修复 bug | PATCH |
| `docs` | 文档变更 | - |
| `style` | 代码格式（不影响逻辑） | - |
| `refactor` | 重构（非新功能、非修复） | - |
| `perf` | 性能优化 | - |
| `test` | 测试相关 | - |
| `chore` | 构建过程/辅助工具变更 | - |
| `ci` | CI/CD 配置变更 | - |
| `revert` | 回滚之前的 commit | - |

### Scope 约定

Scope 用于说明本次改动的影响范围，本项目常用的 scope：

| Scope | 说明 |
|-------|------|
| `table` | Table 组件 |
| `form` | Form 组件 |
| `modal` | Modal 组件 |
| `drawer` | Drawer 组件 |
| `auth` | 权限认证模块 |
| `layout` | 布局组件 |
| `utils` | 工具函数 |
| `config` | 配置文件 |
| `deps` | 依赖管理 |

### Body 和 Footer

**Body（可选）：** 详细描述本次修改的内容

**Footer（可选）：**
- `Closes #123` — 关联 Issue（关闭）
- `Refs #456` — 关联 Issue（不关闭）
- `BREAKING CHANGE:` — 破坏性变更声明

### 破坏性变更示例

```
feat(auth): 重构 token 鉴权机制

- 使用 JWT 替换 session 鉴权
- 移除 deprecated 的 getSession 方法
- 新增 TokenManager 工具类

BREAKING CHANGE: getSession() 方法已移除，请使用 TokenManager.getToken()
```

> 包含 `BREAKING CHANGE:` 的 feat commit 在执行 `release` 时会触发 MAJOR 版本升级。

## Git Tag 管理

### 手动创建和推送 Tag

由于配置了 `skip.tag: true`，需要手动管理 Git Tag：

```bash
# 1. 执行 release 命令（生成 changelog + version bump commit）
pnpm run release:minor

# 2. 创建 annotated tag
git tag -a v1.3.0 -m "Release v1.3.0"

# 3. 推送 commit 和 tag
git push origin main
git push origin v1.3.0
```

### Tag 命名规范

- 使用语义化版本：`vMAJOR.MINOR.PATCH`
- 前缀使用 `v`：`v1.2.3`
- 使用 Annotated Tag（带附注信息）

### 查看 Tag 信息

```bash
# 查看所有 tag
git tag -l

# 查看 tag 详情
git show v1.3.0

# 查看两个 tag 之间的 commit
git log v1.2.0..v1.3.0 --oneline
```

## npm publish 流程

如果需要将包发布到 npm registry：

```bash
# 1. 更新版本
pnpm run release:minor

# 2. 构建
pnpm run build

# 3. 登录 npm（首次需要）
npm login

# 4. 发布
npm publish --access public

# 5. 创建 tag 并推送
git tag -a v1.3.0 -m "Release v1.3.0"
git push origin main --tags
```

### 发布前检查清单

- [ ] 所有测试通过 (`pnpm run test:unit`)
- [ ] 类型检查通过 (`pnpm run type-check`)
- [ ] Lint 检查通过 (`pnpm run lint:fix`)
- [ ] CHANGELOG.md 内容正确
- [ ] package.json version 已更新
- [ ] 无安全漏洞 (`pnpm audit`)

## 完整发布流程示例

### 日常补丁发布流程

```bash
# 1. 确认当前在 main 分支且代码最新
git checkout main && git pull

# 2. 运行测试和质量检查
pnpm run test:unit && pnpm run type-check && pnpm run lint:fix

# 3. 执行补丁发布
pnpm run release:patch

# 4. 检查生成的 CHANGELOG
cat CHANGELOG.md | head -30

# 5. 创建 tag
git tag -a v1.2.4 -m "Release v1.2.4"

# 6. 推送
git push origin main
git push origin v1.2.4
```

### 大版本发布流程

```bash
# 1. 确保所有 breaking change 都有标注
git log v1.0.0..main --oneline | grep "BREAKING"

# 2. 执行 major 发布
pnpm run release:major

# 3. 仔细审查 CHANGELOG 中的 Breaking Changes 部分
cat CHANGELOG.md

# 4. 创建 tag
git tag -a v2.0.0 -m "Release v2.0.0 - Major version upgrade"

# 5. 推送
git push origin main
git push origin v2.0.0

# 6. 在 GitHub 上创建 Release Notes
gh release create v2.0.0 ./CHANGELOG.md --title "v2.0.0"
```
