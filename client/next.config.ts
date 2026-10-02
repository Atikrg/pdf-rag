import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:5000";

// The rewrites proxy buffers the request body and defaults to a 10MB ceiling.
// On overflow it ends the stream mid-body, so the backend sees an aborted
// request and the browser gets an opaque socket hang-up.
//
// This ceiling must sit *above* the backend's MAX_UPLOAD_BYTES (25MB), with
// headroom for multipart boundaries and form fields. Set too low and the proxy
// truncates first, so the backend's clean "File is too large" 400 never reaches
// the user. Set too high and oversized bodies are fully buffered here first,
// which costs memory the backend was supposed to be the guard for.
const maxProxyBodyBytes = Number(
  process.env.MAX_PROXY_BODY_BYTES ?? 32 * 1024 * 1024,
);

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    proxyClientMaxBodySize: maxProxyBodyBytes,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;