import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output keeps the Vultr deploy small: `node .next/standalone/server.js`.
  output: "standalone",
  serverExternalPackages: ["mongodb"],
};

export default nextConfig;
