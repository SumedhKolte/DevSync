import type { NextConfig } from "next";
import { canonicalLocalUrl } from "./src/lib/auth";
const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    const origin = new URL(
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    );
    // Config redirects preserve the absolute destination. Proxy redirects are
    // relativized against the server's bind address, which can cause a loop.
    return ["localhost", "127.0.0.1", "[::1]"].flatMap((hostname) => {
      const alias = new URL(origin);
      alias.hostname = hostname;
      if (!canonicalLocalUrl(alias.toString(), origin.toString())) return [];
      return [
        {
          source: "/:path*",
          has: [
            {
              type: "header" as const,
              key: "host",
              value: alias.host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            },
          ],
          destination: `${origin.origin}/:path*`,
          permanent: false,
        },
      ];
    });
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
