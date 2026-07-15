import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const clientArchitectureRules = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: ["@bodegia/api", "@bodegia/api/*"],
          message: "Clients consume the REST API, never API internals.",
        },
        {
          group: ["@prisma/client", "pg", "postgres", "@supabase/supabase-js"],
          message: "Mobile and web must not access PostgreSQL directly.",
        },
        {
          group: ["**/apps/api/src/infrastructure/**"],
          message: "API infrastructure is server-only.",
        },
      ],
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      ".specify/**",
      ".agents/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  { files: ["apps/mobile/**/*.ts", "apps/web/**/*.ts"], rules: clientArchitectureRules },
  { files: ["**/*.js"], extends: [tseslint.configs.disableTypeChecked] },
);
