import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { setAvailability } from "@/db/repository";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "analyst") return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = (await request.json()) as { available?: boolean };
  setAvailability(user.id, Boolean(body.available));
  return NextResponse.json({ available: Boolean(body.available) });
}
