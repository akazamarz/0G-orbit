import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const webappRoot = path.dirname(fileURLToPath(import.meta.url));

const wagmiAliases = {
  wagmi: path.join(webappRoot, "node_modules/wagmi"),
  "@wagmi/core": path.join(webappRoot, "node_modules/@wagmi/core"),
  "@wagmi/connectors": path.join(webappRoot, "node_modules/@wagmi/connectors"),
};

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@orbit/shared",
    "@0gfoundation/0g-storage-ts-sdk",
    "@rainbow-me/rainbowkit",
    "wagmi",
    "@wagmi/core",
    "@wagmi/connectors",
  ],
  // Relative paths only - Turbopack on Windows rejects absolute resolveAlias.
  turbopack: {
    resolveAlias: {
      wagmi: "./node_modules/wagmi",
      "@wagmi/core": "./node_modules/@wagmi/core",
      "@wagmi/connectors": "./node_modules/@wagmi/connectors",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      ...wagmiAliases,
    };
    return config;
  },
};

export default nextConfig;
