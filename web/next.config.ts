import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output bundles only what's needed for `node server.js`,
  // so the runtime image stays small.
  output: "standalone",
};

export default nextConfig;
