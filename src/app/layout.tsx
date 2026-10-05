import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "311 CONSULTORES | Reportes",
  description: "Plataforma de reportes de actividades de 311 CONSULTORES",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
