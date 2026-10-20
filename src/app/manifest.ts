import type { MetadataRoute } from "next";

/** Manifiesto de la app instalable (PWA): nombre, ícono y pantalla completa. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Portal de Operaciones · 311 Consultores",
    short_name: "Portal 311",
    description: "Portal de Operaciones de 311 CONSULTORES",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "es-MX",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
