import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    return {
      // Real, refresh-safe URLs for the auth screens. The app is a single-page
      // experience rendered from `/`, but /signup and /signin (plus the /login
      // alias) must survive a hard refresh and be shareable — so they are
      // rewritten to `/` BEFORE file routing, and the client boot derives its
      // initial view from window.location.pathname.
      beforeFiles: [
        { source: "/signup", destination: "/" },
        { source: "/signin", destination: "/" },
        { source: "/login", destination: "/" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
