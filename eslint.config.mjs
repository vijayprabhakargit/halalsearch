import nextConfig from "eslint-config-next/core-web-vitals";

const config = [
  ...nextConfig,
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**"],
  },
];

export default config;
