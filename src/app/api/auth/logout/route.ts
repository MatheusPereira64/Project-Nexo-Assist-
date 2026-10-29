import { NextResponse } from "next/server";
import { deleteSession } from "@/db/repository";
import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

function tokenFrom(request: Request): string | undefined {
  const cookie = request.headers.get("cookie") ?? "";
  const raw = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return raw ? decodeURIComponent(raw) : undefined;
}

export async function POST(request: Request) {
  const token = tokenFrom(request);
  if (token) deleteSession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
