"use client";

import { useEffect, useState } from "react";
import type { ConversationView, MessageView, PublicUser, TicketView } from "@/domain/blocks";
import type { DraftInput } from "@/domain/policy";
import { SESSION_MESSAGE_LIMIT } from "@/domain/types";
import { EmployeeShell } from "./employee-shell";
import { Thread } from "./thread";

type Payload = {
  conversation: ConversationView;
  messages: MessageView[];
  tickets: TicketView[];
  sessionCount: number;
};

export function ChatScreen({ user, initial }: { user: PublicUser; initial: Payload }) {
  const [data, setData] = useState(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sending) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [sending, data.conversation.id]);

  async function refresh() {
    const response = await fetch(`/api/conversations/${data.conversation.id}`);
    if (!response.ok) return;
    setData((await response.json()) as Payload);
  }

  function apply(payload: Payload) {
    setData(payload);
  }

  async function send(value: string) {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    setText("");
    setError(null);
    setSending(true);
    setData((current) => ({
      ...current,
      messages: [
        ...current.messages,
        localMessage(current.conversation.id, "user", user.name, trimmed),
        data.conversation.state === "with_agent" ? localMessage(current.conversation.id, "assistant", "Nexo Assist", "") : localMessage(current.conversation.id, "user", user.name, ""),
      ].filter((message) => message.content !== "" || message.role === "assistant"),
    }));
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: data.conversation.id, text: trimmed }),
      });
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({ error: "Falha ao enviar." }))) as { error?: string };
        throw new Error(payload.error ?? "Falha ao enviar.");
      }
      let failed = false;
      await readStream(response.body, (event) => {
        if (event.type === "token") {
          setData((current) => ({
            ...current,
            messages: current.messages.map((message) =>
              message.id === "local-agent" ? { ...message, content: message.content + event.text } : message,
            ),
          }));
        } else if (event.type === "done") apply(event);
        else if (event.type === "error") {
          failed = true;
          setError(event.message);
        }
      });
      if (failed) await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao enviar.");
      await refresh();
    } finally {
      setSending(false);
    }
  }

  async function act(type: string) {
    if (type === "add-info") {
      document.getElementById("composer")?.focus();
      return;
    }
    if (type === "decline") {
      await send("Não, obrigado");
      return;
    }
    setSending(true);
    setError(null);
    const response = await fetch(`/api/conversations/${data.conversation.id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const payload = (await response.json()) as Payload & { error?: string };
    setSending(false);
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível concluir.");
      return;
    }
    apply(payload);
  }

  async function onDraft(draftId: string, action: "confirm" | "cancel" | "edit", patch?: Partial<DraftInput>) {
    setError(null);
    const response = await fetch(`/api/drafts/${draftId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, patch }),
    });
    const payload = (await response.json()) as Payload & { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível atualizar o rascunho.");
      return;
    }
    apply(payload);
  }

  const waiting = data.conversation.state !== "with_agent";
  const presence =
    data.conversation.state === "waiting"
      ? "Aguardando atendente"
      : data.conversation.state === "with_analyst"
        ? `${data.conversation.analystName ?? "Analista"} atendendo`
        : "Assistente online";
  const locked = data.sessionCount >= SESSION_MESSAGE_LIMIT && data.conversation.state === "with_agent";

  return (
    <EmployeeShell user={user} active="atendimento" title="Atendimento" presence={presence}>
      <div className="thread-wrap">
        <Thread
          messages={data.messages}
          interactive={data.conversation.state === "with_agent" && !sending}
          onChoice={(label) => void send(label)}
          onAction={(id) => void act(id === "transfer" ? "transfer" : id)}
          onDraft={(draftId, action, patch) => void onDraft(draftId, action, patch)}
        />
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send(text);
          }}
        >
          <input
            id="composer"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={waiting ? "Escreva para o atendente…" : "Escreva para o Nexo…"}
            disabled={locked || sending}
            aria-label="Mensagem"
          />
          <button className="btn" type="submit" disabled={locked || sending || !text.trim()}>
            Enviar
          </button>
        </form>
        <div className="counter">
          {Math.min(data.sessionCount, SESSION_MESSAGE_LIMIT)}/{SESSION_MESSAGE_LIMIT} mensagens nesta sessão
        </div>
      </div>
    </EmployeeShell>
  );
}

function localMessage(conversationId: string, role: "user" | "assistant", authorName: string, content: string): MessageView {
  return {
    id: role === "assistant" ? "local-agent" : `local-user-${content.slice(0, 12)}`,
    conversationId,
    role,
    authorName,
    content,
    createdAt: new Date().toISOString(),
    chips: [],
    trace: null,
    blocks: [],
  };
}

async function readStream(body: ReadableStream<Uint8Array>, onEvent: (event: StreamEvent) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    buffer += decoder.decode(next.value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.split("\n").find((item) => item.startsWith("data:"));
      if (!line) continue;
      onEvent(JSON.parse(line.slice(5).trim()) as StreamEvent);
    }
  }
}

type StreamEvent =
  | { type: "token"; text: string }
  | ({ type: "done" } & Payload)
  | { type: "error"; message: string };
