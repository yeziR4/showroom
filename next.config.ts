import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Self-contained server bundle for the Docker image (ModelScope Studio).
  output: "standalone",
  // Served under a sub-path on ModelScope (Gradio owns "/" there). Empty on Vercel.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
};

export default nextConfig;
