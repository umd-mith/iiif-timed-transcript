import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs["flat/recommended"],
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    files: ["**/*.svelte.ts"],
    languageOptions: {
      parser: svelte.parser,
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    files: ["src/test/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/ban-types": "off",
    },
  },
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".svelte-kit/**",
      "svelte.config.js",
      "**/*.d.ts",
    ],
  },
);
