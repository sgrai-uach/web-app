import type { NextConfig } from "next";
import os from "node:os";

function getLocalDevOrigins(): string[] {
  const origins = new Set<string>(["localhost", "127.0.0.1"]);
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const netList = interfaces[name];
      if (netList) {
        for (const net of netList) {
          if (net.family === "IPv4" && !net.internal) {
            origins.add(net.address);
          }
        }
      }
    }
    const hostname = os.hostname();
    if (hostname) {
      origins.add(hostname);
      origins.add(`${hostname}.local`);
    }
  } catch {
    // Ignorar errores al enumerar interfaces de red
  }

  if (process.env.ALLOWED_DEV_ORIGINS) {
    for (const o of process.env.ALLOWED_DEV_ORIGINS.split(",")) {
      const trimmed = o.trim();
      if (trimmed) origins.add(trimmed);
    }
  }

  return Array.from(origins);
}

const apiBackendUrl =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4001";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/terreno",
  devIndicators: false,
  allowedDevOrigins: getLocalDevOrigins(),
  async redirects() {
    return [
      {
        source: "/",
        destination: "/terreno",
        basePath: false,
        permanent: false,
      },
      {
        source: "/login",
        destination: "/terreno/login",
        basePath: false,
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBackendUrl}/api/:path*`,
        basePath: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/terreno",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
