import { NextResponse } from "next/server";
import { getUserByEmail, insertPasswordReset } from "@/db/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  const user = email ? getUserByEmail(email) : undefined;
  if (user) insertPasswordReset(user.id, user.email);
  return NextResponse.json({
    message: "Se o e-mail estiver na Nexo, enviaremos um link de redefinição.",
  });
}
