import { RequestContext } from "@mastra/core/request-context";
import type { Block, MessageView, Trace } from "@/domain/blocks";
import { userAskedForAnalyst } from "@/domain/policy";
import type { Priority } from "@/domain/types";
import { transferConversation } from "@/services/desk";
import { mastra, modelId } from "./index";
import type { AgentContext } from "./tools";

type ToolResult = { toolName?: string; result?: unknown };

const CHIP_BY_TOOL: Record<string, string> = {
  "search-help": "buscou na central de ajuda",
  "searchHelpTool": "buscou na central de ajuda",
  "list-tickets": "consultou seus chamados",
  "listTicketsTool": "consultou seus chamados",
  "classify-priority": "classificou a prioridade",
  "classifyPriorityTool": "classificou a prioridade",
  "prepare-draft": "montou o rascunho",
  "prepareDraftTool": "montou o rascunho",
  "transfer-conversation": "encaminhou para um analista",
  "transferTool": "encaminhou para um analista",
};

export function assertModelConfigured(): void {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("Defina OPENAI_API_KEY no arquivo .env para o Nexo Assist responder.");
  }
}

export async function runAgent(input: {
  context: AgentContext;
  history: MessageView[];
  onToken: (text: string) => void;
}): Promise<{ content: string; chips: string[]; trace: Trace; blocks: Block[] }> {
  assertModelConfigured();
  const requestContext = new RequestContext();
  requestContext.setRaw("userId", input.context.userId);
  requestContext.setRaw("userName", input.context.userName);
  requestContext.setRaw("department", input.context.department);
  requestContext.setRaw("conversationId", input.context.conversationId);
  requestContext.setRaw("userText", input.context.userText);

  const messages = input.history
    .filter((message) => message.role !== "system")
    .slice(-12)
    .map((message) =>
      message.role === "user"
        ? { role: "user" as const, content: message.content }
        : {
            role: "assistant" as const,
            content: message.role === "analyst" ? `Analista ${message.authorName}: ${message.content}` : message.content,
          },
    );

  const agent = mastra.getAgent("nexoAssist");
  const stream = await agent.stream(messages, {
    requestContext,
    maxSteps: 8,
    model: modelId(),
  });

  let content = "";
  const reader = stream.textStream.getReader();
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    content += next.value;
    input.onToken(next.value);
  }

  const toolResults = (await stream.toolResults) as ToolResult[];
  const built = buildTrace(toolResults, input.context.userText, content);
  if (!built.transferred && shouldForceTransfer(input.context.userText, built.trace, toolResults)) {
    try {
      const result = transferConversation({
        conversationId: input.context.conversationId,
        actor: { id: input.context.userId, role: "employee" },
        userAsked: userAskedForAnalyst(input.context.userText),
        confidence: built.trace.confidence,
        priority: built.priority,
        overdue: built.overdue,
        summary: built.trace.understood,
        reason: built.trace.reason,
      });
      if (result.ok) {
        built.trace.tools.push("transfer-conversation");
        if (!built.chips.includes("encaminhou para um analista")) built.chips.push("encaminhou para um analista");
        if (!/encaminh|analista/i.test(content)) {
          content = `${content}\n\nEncaminhei para o Suporte ${result.queue}. Um analista segue daqui.`.trim();
        }
      }
    } catch {
      // A fila humana continua disponível pelo botão se o legado falhar agora.
    }
  }

  return { content: content.trim() || "Não consegui formular a resposta. Pode repetir em uma frase?", chips: built.chips, trace: built.trace, blocks: built.blocks };
}

function shouldForceTransfer(userText: string, trace: Trace, results: ToolResult[]): boolean {
  if (results.some((result) => result.toolName?.includes("transfer") && !isRefused(result.result))) return false;
  if (userAskedForAnalyst(userText)) return true;
  if (trace.confidence < 55) return true;
  return results.some((result) => {
    const ticket = asRecord(result.result)?.ticket as { overdue?: boolean; priority?: string } | undefined;
    return ticket?.overdue === true || ticket?.priority === "critical";
  });
}

function buildTrace(results: ToolResult[], userText: string, content: string): {
  chips: string[];
  trace: Trace;
  blocks: Block[];
  transferred: boolean;
  priority: Priority | null;
  overdue: boolean;
} {
  const chips: string[] = [];
  const blocks: Block[] = [];
  const tools: string[] = [];
  let decision: Partial<Trace> | null = null;
  let priority: Priority | null = null;
  let overdue = false;
  let transferred = false;

  for (const result of results) {
    const name = result.toolName ?? "";
    const payload = asRecord(result.result);
    tools.push(name);
    const chip = chipFor(name, payload);
    if (chip && !chips.includes(chip)) chips.push(chip);
    if ((name.includes("classify") || name.includes("prepare")) && !chips.includes("consultou o SLA")) {
      chips.push("consultou o SLA");
    }
    const block = payload?.block;
    if (isBlock(block)) blocks.push(block);
    if (payload?.decision && typeof payload.decision === "object") decision = payload.decision as Partial<Trace>;
    if (typeof payload?.priority === "string") priority = payload.priority as Priority;
    const ticket = asRecord(payload?.ticket);
    if (ticket?.overdue === true) overdue = true;
    if (payload?.transferred === true) transferred = true;
  }

  const trace: Trace = {
    understood: decision?.understood || userText,
    action: decision?.action || (tools.length ? `Usou ${tools.join(", ")}.` : content.slice(0, 180)),
    confidence: typeof decision?.confidence === "number" ? decision.confidence : tools.length ? 72 : 48,
    reason: decision?.reason || "Leitura das ferramentas usadas nesta resposta. O registro explícito do agent não veio.",
    tools,
  };

  return { chips, trace, blocks, transferred, priority, overdue };
}

function chipFor(name: string, payload: Record<string, unknown> | null): string | null {
  if (name.includes("get-ticket") || name.includes("getTicket")) {
    const ticket = asRecord(payload?.ticket);
    return ticket?.code ? `consultou o ${String(ticket.code)}` : "consultou o chamado";
  }
  return CHIP_BY_TOOL[name] ?? null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function isBlock(value: unknown): value is Block {
  return Boolean(value && typeof value === "object" && "type" in value);
}

function isRefused(result: unknown): boolean {
  return Boolean(asRecord(result)?.refused);
}
