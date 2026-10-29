import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { insertPasswordReset } from "@/db/repository";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "employee") return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  insertPasswordReset(user.id, user.email);
  return NextResponse.json({
    message: `Pronto. Enviaremos um link de redefinição para ${user.email}.`,
  });
}
