import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    files: ["src/**/*.ts", "tests/**/*.ts", "examples/**/*.mjs", "playwright.config.ts"],
    extends: [tseslint.configs.base],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    ignores: ["dist/", "node_modules/", "coverage/", "playwright-report/", "test-results/", "scripts/"],
  },
);
