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
      "react-hooks/set-state-in-effect": "off",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/font/google",
              message:
                "Prohibido next/font/google: el build Docker/CI no tiene salida a Internet y falla en next/font. Usa next/font/local con src/fonts/noto-sans (ver AGENTS.md, seccion Build y Fuentes).",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
