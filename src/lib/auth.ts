import { cookies } from "next/headers";
import { getUserBySession } from "@/db/repository";
import type { PublicUser } from "@/domain/blocks";

export const SESSION_COOKIE = "nexo_session";

export async function getCurrentUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getUserBySession(token);
}

export function sessionMaxAge(keepConnected: boolean): number {
  return keepConnected ? 60 * 60 * 24 * 14 : 60 * 60 * 12;
}
