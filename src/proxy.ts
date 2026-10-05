import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

export async function proxy(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  let valid = false;
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
      valid = true;
    } catch {}
  }

  const isLogin = req.nextUrl.pathname === "/login";
  if (!valid && !isLogin) return NextResponse.redirect(new URL("/login", req.url));
  if (valid && isLogin) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
