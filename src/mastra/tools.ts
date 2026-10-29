import { createTool } from "@mastra/core/tools";
import { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";
import { classifyPriority, isOutOfScope, userAskedForAnalyst } from "@/domain/policy";
import { deadlineFor, priorityWindowLabel } from "@/domain/sla";
import { CATEGORIES, IMPACT_LABEL, IMPACTS, PRIORITIES } from "@/domain/types";
import { searchHelp } from "@/services/knowledge";
import { queueFor, transferConversation } from "@/services/desk";
import { listTicketsFor, readTicket, saveDraft, TicketServiceUnavailable, withTicketService } from "@/services/tickets";

export type AgentContext = {
  userId: string;
  userName: string;
  department: string;
  conversationId: string;
  userText: string;
};

function readContext(requestContext: RequestContext): AgentContext {
  return {
    userId: String(requestContext.get("userId") ?? ""),
    userName: String(requestContext.get("userName") ?? ""),
    department: String(requestContext.get("department") ?? ""),
    conversationId: String(requestContext.get("conversationId") ?? ""),
    userText: String(requestContext.get("userText") ?? ""),
  };
}

async function legacy<T>(fn: () => T): Promise<T | { unavailable: true; summary: string }> {
  try {
    return await withTicketService(fn);
  } catch (error) {
    if (error instanceof TicketServiceUnavailable) {
      return { unavailable: true, summary: error.message };
    }
    throw error;
  }
}

export const searchHelpTool = createTool({
  id: "search-help",
  description: "Busca artigos curtos da central de ajuda da Nexo. Use antes de abrir chamado para uma dúvida.",
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    const articles = searchHelp(query);
    return {
      summary: articles.length ? `Encontrei ${articles.length} artigo(s).` : "Nenhum artigo cobre esse caso.",
      articles,
    };
  },
});

export const listTicketsTool = createTool({
  id: "list-tickets",
  description: "Lista os chamados da pessoa que está na conversa. Não aceita outro usuário.",
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const bag = readContext(context.requestContext);
    const result = await legacy(() => listTicketsFor({ id: bag.userId, role: "employee" }, bag.userId));
    if ("unavailable" in result) return result;
    const open = result.filter((ticket) => ticket.status !== "resolved");
    return {
      summary: `${result.length} chamado(s), ${open.length} em aberto.`,
      block: { type: "tickets" as const, tickets: open },
      tickets: result.map((ticket) => ({
        id: ticket.id,
        code: ticket.code,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        overdue: ticket.overdue,
        category: ticket.category,
      })),
    };
  },
});

export const getTicketTool = createTool({
  id: "get-ticket",
  description: "Lê um chamado pelo código, somente se for da pessoa da conversa.",
  inputSchema: z.object({ code: z.string() }),
  execute: async ({ code }, context) => {
    const bag = readContext(context.requestContext);
    const result = await legacy(() => readTicket({ id: bag.userId, role: "employee" }, code));
    if ("unavailable" in result) return result;
    return {
      summary: `${result.code} está ${result.status}${result.overdue ? " e vencido" : ""}.`,
      block: { type: "ticket" as const, ticket: result },
      ticket: result,
    };
  },
});

export const classifyPriorityTool = createTool({
  id: "classify-priority",
  description: "Classifica a prioridade pelo Anexo A e calcula o prazo da primeira resposta.",
  inputSchema: z.object({
    impact: z.enum(IMPACTS),
    stopped: z.boolean(),
    blocksWork: z.boolean(),
    sameDayCommitment: z.boolean(),
    kind: z.enum(["incident", "request"]),
  }),
  execute: async (input) => {
    const priority = classifyPriority(input);
    const dueAt = deadlineFor(priority, new Date()).toISOString();
    return {
      summary: `Prioridade ${priority}, prazo de ${priorityWindowLabel(priority)}.`,
      priority,
      dueAt,
      window: priorityWindowLabel(priority),
    };
  },
});

export const prepareDraftTool = createTool({
  id: "prepare-draft",
  description: "Monta um rascunho para a pessoa confirmar. Não cria o chamado.",
  inputSchema: z.object({
    title: z.string(),
    description: z.string(),
    type: z.enum(["INC", "REQ"]),
    category: z.enum(CATEGORIES),
    priority: z.enum(PRIORITIES),
    impact: z.enum(IMPACTS),
    existingTicketId: z.string().optional(),
  }),
  execute: async (input, context) => {
    const bag = readContext(context.requestContext);
    if (isOutOfScope(`${bag.userText}\n${input.title}\n${input.description}`)) {
      return { refused: true, summary: "Fora de TI. Redirecione sem abrir chamado." };
    }
    const result = await legacy(() =>
      saveDraft({
        conversationId: bag.conversationId,
        requesterId: bag.userId,
        draft: { ...input, requesterId: bag.userId },
      }),
    );
    if ("unavailable" in result) return result;
    const duplicateNote =
      result.duplicate === "update"
        ? "Há chamado aberto parecido: a confirmação vai atualizar, não duplicar."
        : result.duplicate === "reopen"
          ? "Há chamado resolvido há até 7 dias: a confirmação vai reabrir."
          : "A confirmação vai criar um chamado novo.";
    return {
      summary: `Rascunho ${result.view.code} aguardando confirmação. ${duplicateNote} Afetados: ${IMPACT_LABEL[input.impact]}.`,
      block: { type: "draft" as const, draft: result.view },
    };
  },
});

export const offerChoiceTool = createTool({
  id: "offer-choice",
  description: "Mostra opções rápidas quando falta uma informação, por exemplo quem é afetado.",
  inputSchema: z.object({
    options: z.array(z.object({ id: z.string(), label: z.string() })).min(2).max(4),
  }),
  execute: async ({ options }) => ({
    summary: "Opções exibidas para a pessoa escolher.",
    block: { type: "choices" as const, options },
  }),
});

export const offerFollowUpTool = createTool({
  id: "offer-follow-up",
  description: "Oferece chamar analista, complementar ou encerrar o assunto quando o caso já foi explicado.",
  inputSchema: z.object({}),
  execute: async () => ({
    summary: "Botões de acompanhamento exibidos.",
    block: {
      type: "actions" as const,
      actions: [
        { id: "transfer", label: "Falar com um analista" },
        { id: "add-info", label: "Adicionar informação" },
        { id: "decline", label: "Não, obrigado" },
      ],
    },
  }),
});

export const transferTool = createTool({
  id: "transfer-conversation",
  description: "Transfere para um analista quando a pessoa pede, o caso é crítico, o chamado está vencido ou você não tem segurança. Envie um resumo curto.",
  inputSchema: z.object({
    summary: z.string(),
    reason: z.string(),
    confidence: z.number().min(0).max(100),
    priority: z.enum(PRIORITIES).optional(),
    overdue: z.boolean().optional(),
    ticketId: z.string().optional(),
  }),
  execute: async (input, context) => {
    const bag = readContext(context.requestContext);
    const userAsked = userAskedForAnalyst(bag.userText) || userAskedForAnalyst(input.reason);
    const result = await legacy(() =>
      transferConversation({
        conversationId: bag.conversationId,
        actor: { id: bag.userId, role: "employee" },
        userAsked,
        confidence: input.confidence,
        priority: input.priority ?? null,
        overdue: input.overdue ?? false,
        summary: input.summary,
        reason: input.reason,
        ticketId: input.ticketId,
      }),
    );
    if ("unavailable" in result) return result;
    if (!result.ok) return { refused: true, summary: result.message };
    return {
      summary: `Conversa com o Suporte ${result.queue}. O agent fica pausado. Prazo da fila: ${queueFor(input.priority ?? null, input.overdue ?? false, input.confidence)}.`,
      transferred: true,
      queue: result.queue,
    };
  },
});

export const recordDecisionTool = createTool({
  id: "record-decision",
  description: "Registra o que você entendeu, a ação, a confiança de 0 a 100 e o motivo. Chame uma vez em toda resposta.",
  inputSchema: z.object({
    understood: z.string(),
    action: z.string(),
    confidence: z.number().min(0).max(100),
    reason: z.string(),
  }),
  execute: async (input) => ({ summary: "Decisão registrada.", decision: input }),
});

export const nexoTools = {
  searchHelpTool,
  listTicketsTool,
  getTicketTool,
  classifyPriorityTool,
  prepareDraftTool,
  offerChoiceTool,
  offerFollowUpTool,
  transferTool,
  recordDecisionTool,
};
