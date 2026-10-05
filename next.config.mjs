/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Docker construye con BUILD_STANDALONE=1 (en Windows el modo standalone puede fallar por symlinks)
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  serverExternalPackages: ["@react-pdf/renderer"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
