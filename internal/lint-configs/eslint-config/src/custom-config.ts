import type { Linter } from 'eslint';

const restrictedImportIgnores = ['**/vite.config.mts'];

const customConfig: Linter.Config[] = [
  // shadcn-ui 内部组件是自动生成的，不做太多限制
  // 路径是本仓的实际位置（`npx shadcn-vue add` 落在 packages/core/ui-kit/shadcn-ui），
  // 生成的 props 声明普遍不带 default，逐文件补默认值会在下次 `add` 时被冲掉。
  {
    files: ['packages/core/ui-kit/shadcn-ui/**/**'],
    rules: {
      'vue/require-default-prop': 'off',
    },
  },
  {
    files: [
      'apps/**/**',
      'packages/utils/**/**',
      'packages/core/base/typings/**/**',
    ],
    ignores: restrictedImportIgnores,
    rules: {
      'perfectionist/sort-interfaces': 'off',
    },
  },
  {
    // apps内部的一些基础规则
    files: ['apps/**/**'],
    ignores: restrictedImportIgnores,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['#/api/*'],
              message:
                'The #/api package cannot be imported, please use the @antdv package itself',
            },
            {
              group: ['#/layouts/*'],
              message:
                'The #/layouts package cannot be imported, please use the @antdv package itself',
            },
            {
              group: ['#/locales/*'],
              message:
                'The #/locales package cannot be imported, please use the @antdv package itself',
            },
            {
              group: ['#/stores/*'],
              message:
                'The #/stores package cannot be imported, please use the @antdv package itself',
            },
          ],
        },
      ],
    },
  },
  {
    // 底层包（design / icons / shared / typings / enums / utils）不能反向依赖上层：
    // ui-kit 组件包、effects（layouts / router / request / directives / preferences / composables）与应用壳。
    // 本仓只有一个 @antdv/* 命名空间，所以边界必须按包名枚举，不能按 scope 写。
    // @antdv/shadcn-ui 是 vendored 原语层（icons 的 IconPicker 依赖它），属于允许项。
    files: [
      'packages/core/base/**/**',
      'packages/enums/**/**',
      'packages/utils/**/**',
    ],
    ignores: restrictedImportIgnores,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@antdv/common-ui',
                '@antdv/form-ui',
                '@antdv/layout-ui',
                '@antdv/menu-ui',
                '@antdv/popup-ui',
                '@antdv/table-ui',
                '@antdv/tabs-ui',
                '@antdv/backend-mock',
                '@antdv/directives',
                '@antdv/hooks',
                '@antdv/layouts',
                '@antdv/preferences',
                '@antdv/request',
                '@antdv/router',
                '@antdv/web',
              ],
              message:
                'Base packages must not depend on ui-kit, effects or app packages. Use the lowest package that already provides this.',
            },
          ],
        },
      ],
    },
  },
  // 后端模拟代码，不需要太多规则
  {
    files: ['apps/backend-mock/**/**', 'docs/**/**'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/**/playwright.config.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['internal/**/**', 'scripts/**/**'],
    rules: {
      'no-console': 'off',
    },
  },
];

export { customConfig };
