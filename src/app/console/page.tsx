import { redirect } from "next/navigation";
import { ConsoleScreen } from "@/components/console-screen";
import { getConversation, listConversations, listMessages, listTicketsByRequester } from "@/db/repository";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "analyst") redirect("/atendimento");
  const conversations = listConversations();
  const preferred =
    conversations.find((item) => item.state === "waiting" && item.queue === user.supportLevel) ?? conversations[0];
  const ticketsByEmployee: Record<string, ReturnType<typeof listTicketsByRequester>> = {};
  for (const conversation of conversations) {
    if (!ticketsByEmployee[conversation.employeeId]) {
      ticketsByEmployee[conversation.employeeId] = listTicketsByRequester(conversation.employeeId);
    }
  }
  const selected = preferred ? getConversation(preferred.id) : undefined;
  return (
    <ConsoleScreen
      analyst={user}
      conversations={conversations}
      ticketsByEmployee={ticketsByEmployee}
      initialId={selected?.id ?? ""}
      initialMessages={selected ? listMessages(selected.id) : []}
      initialTickets={selected ? listTicketsByRequester(selected.employeeId) : []}
    />
  );
}
