import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3"],
  // SVAR packages are ESM; transpile so Webpack can follow their deps.
  transpilePackages: [
    "@daypicker/react",
    "@daypicker/persian",
    "@svar-ui/react-gantt",
    "@svar-ui/react-core",
    "@svar-ui/react-grid",
    "@svar-ui/react-menu",
    "@svar-ui/react-toolbar",
    "@svar-ui/react-editor",
    "@svar-ui/react-filter",
    "@svar-ui/react-tasklist",
    "@svar-ui/react-comments",
    "@svar-ui/gantt-store",
    "@svar-ui/grid-store",
  ],
};

export default nextConfig;