import pluginVitest from "@vitest/eslint-plugin";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import { globalIgnores } from "eslint/config";
import skipFormatting from "eslint-config-prettier/flat";
import importPlugin from "eslint-plugin-import";
import pluginOxlint from "eslint-plugin-oxlint";
import pluginPlaywright from "eslint-plugin-playwright";
import pluginVue from "eslint-plugin-vue";

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: "app/files-to-lint",
    files: ["**/*.{vue,ts,mts,tsx}"],
    ignores: ["**/node_modules/**", "**/dist/**", "**/test/**"],
  },
  importPlugin.flatConfigs.recommended,
  globalIgnores(["**/dist/**", "**/dist-ssr/**", "**/coverage/**"]),

  ...pluginVue.configs["flat/essential"],
  vueTsConfigs.recommended,

  {
    ...pluginPlaywright.configs["flat/recommended"],
    files: ["e2e/**/*.{test,spec}.{js,ts,jsx,tsx}"],
  },

  {
    ...pluginVitest.configs.recommended,
    files: ["src/**/__tests__/*"],
  },

  ...pluginOxlint.buildFromOxlintConfigFile(".oxlintrc.json"),

  skipFormatting,
  {
    files: ["**/*.{vue,ts,mts,tsx}"],
    ignores: ["**/node_modules/**", "**/dist/**", "**/test/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-unused-vars": "off", // 关闭原生规则
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "vue/multi-word-component-names": "off",
      "import/no-unresolved": "off",
      "import/named": "off",
      "import/namespace": "off",
      "import/order": [
        "error",
        {
          groups: ["external", "builtin", ["parent", "sibling"], "index", "object", "type"],
          "newlines-between": "always-and-inside-groups",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
          named: true,
          sortTypesGroup: true,
          consolidateIslands: "inside-groups",
        },
      ],
    },
  },
);
