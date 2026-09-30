import type { NextConfig } from "next";

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  // Same-origin proxy so the browser avoids CORS when calling the Fastify API.
  async rewrites() {
    return [
      { source: "/backend-api/:path*", destination: `${apiOrigin}/:path*` },
    ];
  },
  // Optional peers pulled in by @wagmi/connectors barrel (tempo / Base / MetaMask SDK).
  // Webpack fails ChunkLoadError if they are unresolved; we don't use those connectors.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      accounts: false,
      "@base-org/account": false,
      "@metamask/connect-evm": false,
      "pino-pretty": false,
    };
    return config;
  },
};

export default nextConfig;
