import js from "@eslint/js";
import typescript from "typescript-eslint";
import next from "@next/eslint-plugin-next";
import globals from "globals";

export default typescript.config(
  js.configs.recommended,
  ...typescript.configs.recommended,
  {
    plugins: { "@next/next": next },
    languageOptions: { globals: globals.browser },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,
    },
  },
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  }
);