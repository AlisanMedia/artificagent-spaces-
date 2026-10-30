import type { NextConfig } from "next";

const isDevelopment = process.env["NODE_ENV"] === "development";
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (isDevelopment ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  images: { remotePatterns: [] },
  serverExternalPackages: ["@electric-sql/pglite", "sharp"],
  // Runtime databases, scoped permits and private media must never enter a deployment trace.
  outputFileTracingExcludes: { "/*": ["./.spaces-local/**/*"] },
  experimental: { cpus: 2 },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" }
      ]
    }];
  }
};

export default config;
