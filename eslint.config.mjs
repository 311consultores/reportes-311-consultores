import nextVitals from "eslint-config-next/core-web-vitals";

const config = [...nextVitals, { ignores: [".next/**", "node_modules/**", "dist-cpanel/**"] }];

export default config;
