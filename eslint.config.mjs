import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  // Source files: full obsidianmd rules with type-aware parsing
  {
    files: ["src/**/*.ts"],
    ignores: ["**/__tests__/**", "**/*.test.ts"],
    plugins: { obsidianmd },
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
    },
    rules: {
      ...obsidianmd.configs.recommended,
      "obsidianmd/ui/sentence-case": ["error", { brands: ["Pocket Casts"] }],
    },
  },
  {
    ignores: ["node_modules/**", "main.js"],
  },
]);
