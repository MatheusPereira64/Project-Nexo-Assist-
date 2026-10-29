import { redirect } from "next/navigation";
import { ChatScreen } from "@/components/chat-screen";
import { countSessionMessages, getConversation, listMessages, listTicketsByRequester } from "@/db/repository";
import { openEmployeeConversation } from "@/services/desk";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AtendimentoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "analyst") redirect("/console");
  const record = openEmployeeConversation(user.id);
  const conversation = getConversation(record.id);
  if (!conversation) redirect("/login");
  return (
    <ChatScreen
      user={user}
      initial={{
        conversation,
        messages: listMessages(record.id),
        tickets: listTicketsByRequester(user.id),
        sessionCount: countSessionMessages(record.id, record.sessionStartedAt),
      }}
    />
  );
}
