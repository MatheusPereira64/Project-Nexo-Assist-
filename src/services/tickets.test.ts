import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";

const file = path.join(os.tmpdir(), `nexo-tickets-${process.pid}.sqlite`);

beforeAll(async () => {
  process.env.NEXO_DB = file;
  process.env.NEXO_AUTO_SEED = "1";
  const client = await import("@/db/client");
  client.closeDb();
  fs.rmSync(file, { force: true });
  const tickets = await import("@/services/tickets");
  tickets.setTicketServiceMode("never");
  client.getDb();
});

afterAll(async () => {
  const client = await import("@/db/client");
  client.closeDb();
  fs.rmSync(file, { force: true });
});

test("o chamado do Matheus está vencido e o de outra pessoa fica oculto", async () => {
  const { listTicketsFor, PrivacyError } = await import("@/services/tickets");
  const ana = listTicketsFor({ id: "user-ana", role: "employee" }, "user-ana");
  expect(ana.find((ticket) => ticket.code === "INC-20311")?.overdue).toBe(true);
  expect(ana).toHaveLength(5);
  expect(() => listTicketsFor({ id: "user-carla", role: "employee" }, "user-ana")).toThrow(PrivacyError);
  const analyst = listTicketsFor({ id: "user-rafael", role: "analyst" }, "user-ana");
  expect(analyst.some((ticket) => ticket.code === "INC-20311")).toBe(true);
});

test("confirmação cria, atualiza e reabre sem duplicar fora da janela", async () => {
  const { confirmDraft, saveDraft } = await import("@/services/tickets");
  const created = saveDraft({
    conversationId: "conv-diego",
    requesterId: "user-diego",
    draft: {
      title: "Monitor sem sinal no HDMI",
      description: "O monitor externo ficou preto depois do cabo HDMI.",
      type: "INC",
      category: "Hardware",
      priority: "medium",
      impact: "only_me",
      requesterId: "user-diego",
    },
  });
  const createdTicket = confirmDraft(created.draft.id, { id: "user-diego", role: "employee" });
  expect(createdTicket.decision).toBe("create");
  expect(createdTicket.ticket.code.startsWith("INC-")).toBe(true);

  const updated = saveDraft({
    conversationId: "conv-ana",
    requesterId: "user-ana",
    draft: {
      title: "Notebook continua lento após a atualização do Windows",
      description: "A lentidão geral depois da atualização do Windows continua.",
      type: "INC",
      category: "Hardware",
      priority: "medium",
      impact: "only_me",
      requesterId: "user-ana",
    },
  });
  expect(confirmDraft(updated.draft.id, { id: "user-ana", role: "employee" }).decision).toBe("update");

  const reopened = saveDraft({
    conversationId: "conv-bruno",
    requesterId: "user-bruno",
    draft: {
      title: "Senha do SAP bloqueada de novo",
      description: "O usuário foi bloqueado no SAP outra vez.",
      type: "INC",
      category: "Acesso",
      priority: "medium",
      impact: "only_me",
      requesterId: "user-bruno",
    },
  });
  expect(confirmDraft(reopened.draft.id, { id: "user-bruno", role: "employee" }).decision).toBe("reopen");
});

test("assunto fora de TI e indisponibilidade do legado", async () => {
  const { saveDraft, setTicketServiceMode, TicketServiceUnavailable, assertTicketService } = await import("@/services/tickets");
  expect(() =>
    saveDraft({
      conversationId: "conv-ana",
      requesterId: "user-ana",
      draft: {
        title: "Marcar férias",
        description: "Quero marcar férias em dezembro com o RH.",
        type: "REQ",
        category: "Outros",
        priority: "low",
        impact: "only_me",
        requesterId: "user-ana",
      },
    }),
  ).toThrow(/fora do service desk/);

  setTicketServiceMode("always");
  expect(() => assertTicketService()).toThrow(TicketServiceUnavailable);
  setTicketServiceMode("never");
});
