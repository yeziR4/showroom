import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Self-contained server bundle for the Docker image (ModelScope Studio).
  output: "standalone",
};

export default nextConfig;
