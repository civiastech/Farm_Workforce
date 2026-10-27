import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "docs/prototype/**",
      "apps/api/drizzle/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      eqeqeq: ["error", "always"],
      "no-console": "off",
    },
  },
  {
    files: ["apps/api/**/*.{ts,mjs}", "packages/**/*.ts", "*.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}", "apps/web/public/**/*.js"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
);
