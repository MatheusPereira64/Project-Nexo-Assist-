import { redirect } from "next/navigation";
import { ProfileScreen } from "@/components/profile-screen";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "employee") redirect("/console");
  return <ProfileScreen user={user} />;
}
