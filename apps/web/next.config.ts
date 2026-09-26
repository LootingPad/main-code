import type { NextConfig } from "next";

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");

const nextConfig: NextConfig = {
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
};

export default nextConfig;
