import { defineConfig } from "oxfmt";

export default defineConfig({
  printWidth: 120,
  semi: false,
  singleQuote: true,
  sortImports: {
    groups: [
      "type-import",
      ["value-builtin", "value-external"],
      "type-internal",
      "value-internal",
      ["type-parent", "type-sibling", "type-index"],
      ["value-parent", "value-sibling", "value-index"],
      "unknown",
    ],
  },
  sortTailwindcss: true,
  sortPackageJson: {
    sortScripts: true,
  },
});
