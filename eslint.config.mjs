import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // This app intentionally fetches/polls in effects (order/parcel tracking
      // polling, merchant fetch on basket change, debounced quote fetch) and
      // hydrates localStorage-backed state (city/basket) on mount. That is the
      // idiomatic pattern here, so keep it as a warning, not a build blocker.
      "react-hooks/set-state-in-effect": "warn",
      // Standard underscore convention for intentionally-unused params/vars.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
