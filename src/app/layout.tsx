import type { Metadata } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { DialogProvider } from "@/components/dialogs";

export const metadata: Metadata = {
  title: "311 CONSULTORES | Reportes",
  description: "Plataforma de reportes de actividades de 311 CONSULTORES",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Cliente: siempre claro. Editor/Admin: automático según el sistema hasta que elijan un modo con el botón.
  const user = await getCurrentUser();
  const theme = user?.role === "CLIENTE" ? "light" : (user?.theme ?? undefined);

  return (
    <html lang="es" data-theme={theme}>
      <body>
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  );
}
