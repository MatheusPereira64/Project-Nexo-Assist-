import { NextResponse } from "next/server";
import { createSession, getUserByEmail } from "@/db/repository";
import { SESSION_COOKIE, sessionMaxAge } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string; keepConnected?: boolean };
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!email || !password.trim()) {
    return NextResponse.json({ error: "Informe o e-mail corporativo e a senha." }, { status: 400 });
  }
  const user = getUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: "Não encontrei esse e-mail na Nexo." }, { status: 401 });
  }
  const token = createSession(user.id, new Date(Date.now() + sessionMaxAge(Boolean(body.keepConnected)) * 1000));
  const response = NextResponse.json({
    role: user.role,
    redirectTo: user.role === "analyst" ? "/console" : "/atendimento",
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAge(Boolean(body.keepConnected)),
  });
  return response;
}
