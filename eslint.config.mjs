import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      ".claude/**",
      "node_modules/**",
      "out/**",
      "public/generated-images/**",
    ],
  },
];

export default eslintConfig;
