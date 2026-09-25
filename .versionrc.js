// .versionrc.js
// standard-version 配置文件（完整示例）
// 官方文档: https://github.com/conventional-changelog/standard-version

const config = {
  // ============================================================
  // 基础配置
  // ============================================================

  // CHANGELOG 输出路径（相对项目根目录）
  infile: 'CHANGELOG.md',

  // 是否模拟运行（true 时不会修改文件、不提交、不打 tag）
  dryRun: false,

  // 是否抑制控制台输出
  silent: false,

  // Git tag 前缀，默认 'v'。会生成 v1.0.0 这样的 tag
  tagPrefix: 'v',

  // 是否标记为首次发布（跳过版本递增，直接用当前版本）
  firstRelease: false,

  // 强制指定版本类型：'major' | 'minor' | 'patch'，或具体版本号如 '2.0.0'
  // releaseAs: 'minor',

  // 预发布标识，如 'alpha'、'beta'、'rc'
  // prerelease: 'alpha',

  // 提交信息模板，%s 会被替换成版本号
  releaseCommitMessageFormat: 'chore(release): 🎉 %s',

  // 是否使用 GPG 对 commit 和 tag 签名
  sign: false,

  // 是否跳过 Git hooks（pre-commit / commit-msg 等）
  noVerify: false,

  // 是否提交所有已暂存的更改，而不仅限于 bumpFiles 中列出的文件
  commitAll: false,

  // ============================================================
  // 版本号写入的文件（bumpFiles 会同时读和写）
  // ============================================================
  bumpFiles: [
    'package.json',
    // 如需同步更新 lock 文件
    // 'pnpm-lock.yaml',
    // 'package-lock.json',
  ],

  // 只从中读取版本号的文件（不写入）
  packageFiles: [
    'package.json',
  ],

  // ============================================================
  // CHANGELOG 生成配置
  // ============================================================

  // 提交信息规范预设：'conventionalcommits' | 'angular' | 'atom' | 'codemirror' 等
  preset: 'conventionalcommits',

  // CHANGELOG 顶部追加内容（%s 会被替换成版本号）
  header: `# Changelog\n\n所有值得注意的变更都会记录在此文件。\n\n`,

  // 提交类型到 CHANGELOG 章节的映射
  // hidden: true 表示不在 CHANGELOG 中显示该类型
  // section 表示章节标题
  types: [
    { type: 'feat', section: '✨ 新功能' },
    { type: 'fix', section: '🐛 Bug 修复' },
    { type: 'perf', section: '⚡ 性能优化' },
    { type: 'refactor', section: '♻️  代码重构' },
    { type: 'docs', section: '📝 文档更新' },
    { type: 'style', section: '💄 代码格式', hidden: true },
    { type: 'test', section: '✅ 测试', hidden: true },
    { type: 'build', section: '📦 构建系统', hidden: true },
    { type: 'ci', section: '👷 CI 配置', hidden: true },
    { type: 'chore', section: '🔧 其他变更', hidden: true },
    { type: 'revert', section: '⏪ 回滚' },
  ],

  // 是否为每条变更附加 commit hash 链接
  // 需配合 repository 字段使用（package.json 中的 repository 字段）
  // 例如：- **feat**: 新增登录功能 ([abc1234](https://github.com/xxx/yyy/commit/abc1234))
  // commitUrlFormat: '{{host}}/{{owner}}/{{repository}}/commit/{{hash}}',
  // compareUrlFormat: '{{host}}/{{owner}}/{{repository}}/compare/{{previousTag}}...{{currentTag}}',
  // issueUrlFormat: '{{host}}/{{owner}}/{{repository}}/issues/{{id}}',
  // userUrlFormat: '{{host}}/{{user}}',

  // ============================================================
  // 生命周期钩子
  // 每个钩子可以是 shell 命令字符串，也可以是函数
  // ============================================================

  scripts: {
    // 发布前执行
    prerelease: `echo "🚀 开始发布流程..."`,

    // 版本号递增之前（若返回版本号字符串，将直接使用该版本号）
    prebump: `echo "📌 版本号即将更新"`,

    // 版本号递增之后
    postbump: `echo "✅ 版本号已更新至新版本"`,

    // 生成 CHANGELOG 之前
    prechangelog: `echo "📝 准备生成 CHANGELOG"`,

    // 生成 CHANGELOG 之后
    postchangelog: `echo "✅ CHANGELOG 已生成"`,

    // 提交之前
    precommit: `echo "📦 准备提交"`,

    // 提交之后
    postcommit: `echo "✅ 已提交"`,

    // 打 tag 之前
    pretag: `echo "🏷️  准备打 tag"`,

    // 打 tag 之后
    posttag: `echo "🎉 发布完成！"`,
  },

};

module.exports = config;
