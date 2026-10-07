/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Docker construye con BUILD_STANDALONE=1 (en Windows el modo standalone puede fallar por symlinks)
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  serverExternalPackages: ["@react-pdf/renderer"],
  // Los logos (hasta 2 MB) viajan en formularios con acciones del servidor; el límite por defecto es 1 MB
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // El trazado de standalone no siempre incluye los motores de Prisma de otras plataformas
  outputFileTracingIncludes: {
    "/**/*": [
      "./node_modules/.prisma/client/**/*",
      // react-pdf lee package.json y datos de estos paquetes en ejecución; el rastreo no los detecta.
      // Se incluye para todas las rutas porque la acción de enviar por correo también genera el PDF.
      "./node_modules/pdfkit/**/*",
      "./node_modules/@react-pdf/**/*",
    ],
  },
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
