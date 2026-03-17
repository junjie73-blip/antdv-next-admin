import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: ['**/node_modules/**', '**/dist/**', '**/_tests_/**'],
  typescript: true,
  vue: true,
  formatters: {
    css: 'prettier',
    html: 'prettier',
    markdown: 'prettier',
    prettierOptions: {
      singleQuote: true,
      jsxSingleQuote: true,
      quoteProps: 'as-needed',
      trailingComma: 'es5',
      plugins: ['prettier-plugin-tailwindcss'],
      tabWidth: 4,
      printWidth: 80,
      bracketSpacing: true,
    },
  },
  rules: {
    'vue/array-element-newline': [
      'error',
      {
        multiline: true,
        minItems: 2,
      },
    ],
    'no-console': 'off',
    'style/semi': ['error', 'never'],
    'style/quotes': ['error', 'single'],
    'node/prefer-global/process': 'off',
    'vue/max-attributes-per-line': ['error', {
      singleline: 1,
      multiline: 1,
    }],
    'import/newline-after-import': ['error', {
      count: 1,
    }],
    'style/object-property-newline': ['error', {
      allowAllPropertiesOnSameLine: true,
    }],
    'vue/attribute-hyphenation': ['error', 'always'],
    'vue/v-on-event-hyphenation': ['error', 'never', { autofix: true }],
    'vue/no-v-html': 'warn', // 提醒 xss 风险，但不强制
    'vue/component-name-in-template-casing': ['error', 'PascalCase'],
    'vue/prop-name-casing': ['error', 'camelCase'],
    'vue/custom-event-name-casing': ['error', 'camelCase'],
    'vue/define-macros-order': ['error', {
      order: ['defineProps', 'defineEmits', 'defineSlots', 'defineOptions', 'defineModel'],
    }],
    'vue/no-unused-refs': 'error',
    'ts/prefer-enum-initializers': 'error',
    'ts/no-explicit-any': 'warn',
    'ts/no-empty-function': ['error', { allow: ['arrowFunctions', 'functions', 'methods'] }],
    'import/no-unresolved': 'off',
    'import/no-duplicates': 'error',
    'ts/ban-ts-comment': 'off',
  },
}, {
  files: ['src/**/*.{ts}'],
  rules: {
    'import/no-default-export': 'error',
  },
})
