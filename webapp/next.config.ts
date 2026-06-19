import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@orbit/shared", "@0gfoundation/0g-storage-ts-sdk"],
};

export default nextConfig;
