import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Coin logos are served by the data worker / CoinGecko; allow remote images.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
