import type { NextConfig } from "next";

// Where the Express API (services/api) is running. Override in .env.local if needed.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // Coin logos are served by the data worker / CoinGecko; allow remote images.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Proxy browser calls to /api/* through to the Express backend.
  // Lets the frontend use relative fetch("/api/...") with no CORS in dev.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
