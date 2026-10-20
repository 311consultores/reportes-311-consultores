import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { DialogProvider } from "@/components/dialogs";

export const metadata: Metadata = {
  title: "Portal de Operaciones",
  description: "Portal de Operaciones de 311 CONSULTORES",
  applicationName: "Portal 311",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Portal 311", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

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
