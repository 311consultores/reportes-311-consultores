import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/** Rutas accesibles sin iniciar sesión. */
const PUBLIC = new Set(["/login", "/recuperar", "/restablecer", "/api/health", "/api/branding/logo"]);

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get("session")?.value;
  let valid = false;
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
      valid = true;
    } catch {}
  }

  if (!valid && !PUBLIC.has(pathname)) {
    // Recuerda a dónde iba (p. ej. el enlace de un reporte recibido por correo) para volver tras el login
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (valid && pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  // La subida de evidencias queda fuera del proxy: Next limita a 10 MB el cuerpo de las peticiones que pasan por él,
  // y esa ruta ya valida la sesión por su cuenta (responde 403 si no hay).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/reports/[^/]+/tasks/[^/]+/evidence).*)"],
};
