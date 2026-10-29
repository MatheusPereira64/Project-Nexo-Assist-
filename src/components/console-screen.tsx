"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConversationView, MessageView, PublicUser, TicketView } from "@/domain/blocks";
import { formatListTime } from "@/lib/format";
import { Mark } from "./icons";
import { Thread } from "./thread";
import { TicketRow } from "./ticket-card";

type Payload = {
  conversation: ConversationView;
  messages: MessageView[];
  tickets: TicketView[];
  sessionCount: number;
  conversations?: ConversationView[];
};

export function ConsoleScreen({
  analyst,
  conversations,
  ticketsByEmployee,
  initialId,
  initialMessages,
  initialTickets,
}: {
  analyst: PublicUser;
  conversations: ConversationView[];
  ticketsByEmployee: Record<string, TicketView[]>;
  initialId: string;
  initialMessages: MessageView[];
  initialTickets: TicketView[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(conversations);
  const [selectedId, setSelectedId] = useState(initialId);
  const [messages, setMessages] = useState(initialMessages);
  const [tickets, setTickets] = useState(initialTickets);
  const [filter, setFilter] = useState<"all" | "foryou" | "agent" | "mine">("foryou");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(analyst.available);
  const [busy, setBusy] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const haystack = `${item.employeeName} ${item.preview} ${item.summary ?? ""}`.toLowerCase();
      if (needle && !haystack.includes(needle)) return false;
      if (filter === "foryou") return item.state === "waiting" && (item.queue === analyst.supportLevel || !item.queue);
      if (filter === "agent") return item.state === "with_agent";
      if (filter === "mine") return item.analystId === analyst.id && item.state === "with_analyst";
      return true;
    });
  }, [analyst.id, analyst.supportLevel, filter, items, query]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetch(`/api/conversations/${selectedId}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: Payload | null) => {
          if (!payload) return;
          setMessages(payload.messages);
          setTickets(payload.tickets);
          setItems((current) => current.map((item) => (item.id === payload.conversation.id ? payload.conversation : item)));
        });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [selectedId]);

  async function open(id: string) {
    setSelectedId(id);
    setShowThread(true);
    setError(null);
    const response = await fetch(`/api/conversations/${id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "read" }),
    });
    if (!response.ok) return;
    const payload = (await response.json()) as Payload;
    setMessages(payload.messages);
    setTickets(payload.tickets);
    if (payload.conversations) setItems(payload.conversations);
  }

  async function act(type: string, text?: string) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/conversations/${selected.id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, text }),
    });
    const payload = (await response.json()) as Payload & { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível concluir.");
      return;
    }
    setMessages(payload.messages);
    setTickets(payload.tickets);
    if (payload.conversations) setItems(payload.conversations);
    if (type === "reply") setDraft("");
    if (type === "assume") setFilter("mine");
    if (type === "return") setFilter("agent");
  }

  const openTickets = tickets.filter((ticket) => ticket.status !== "resolved");
  const closedTickets = tickets.filter((ticket) => ticket.status === "resolved");
  const featured = tickets.find((ticket) => ticket.conversationId === selected?.id) ?? openTickets[0];
  const counts = {
    foryou: items.filter((item) => item.state === "waiting" && (item.queue === analyst.supportLevel || !item.queue)).length,
    agent: items.filter((item) => item.state === "with_agent").length,
    mine: items.filter((item) => item.analystId === analyst.id && item.state === "with_analyst").length,
  };
  const mine = selected?.state === "with_analyst" && selected.analystId === analyst.id;

  return (
    <div className={`console${showThread ? " show-thread" : ""}${historyOpen ? " history-open" : ""}`}>
      <button className="history-backdrop" type="button" aria-label="Fechar chamados" onClick={() => setHistoryOpen(false)} />
      <aside className="rail">
        <Mark />
        <button className="rail-btn" type="button" aria-label="Conversas">
          {items.filter((item) => item.unreadForAnalyst > 0).length || "·"}
        </button>
        <div className="rail-spacer" />
        <button
          className="avatar"
          type="button"
          aria-label="Sair"
          title="Sair"
          onClick={() => {
            void fetch("/api/auth/logout", { method: "POST" }).then(() => router.push("/login"));
          }}
        >
          {analyst.initials}
        </button>
      </aside>
      <aside className="inbox">
        <header>
          <div className="card-top">
            <strong>Conversas</strong>
            <button
              className="linkish"
              type="button"
              onClick={() => {
                const next = !available;
                setAvailable(next);
                void fetch("/api/me", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ available: next }),
                });
              }}
            >
              {available ? "Disponível" : "Indisponível"}
            </button>
          </div>
          <input
            type="search"
            placeholder="Pesquisar conversa ou chamado"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Pesquisar conversa ou chamado"
            className="inbox-search"
          />
          <div className="filters">
            <button className={filter === "all" ? "filter active" : "filter"} type="button" onClick={() => setFilter("all")}>
              Todas
            </button>
            <button className={filter === "foryou" ? "filter active" : "filter"} type="button" onClick={() => setFilter("foryou")}>
              Para você {counts.foryou}
            </button>
            <button className={filter === "agent" ? "filter active" : "filter"} type="button" onClick={() => setFilter("agent")}>
              Com o agent {counts.agent}
            </button>
            <button className={filter === "mine" ? "filter active" : "filter"} type="button" onClick={() => setFilter("mine")}>
              Minhas {counts.mine}
            </button>
          </div>
        </header>
        <div className="people">
          {visible.map((item) => (
            <button key={item.id} className={item.id === selected?.id ? "person active" : "person"} type="button" onClick={() => void open(item.id)}>
              <div className={`avatar ${toneClass(item.employeeId)}`}>{item.employeeInitials}</div>
              <div>
                <b>{item.employeeName}</b>
                <div className="note">{item.preview}</div>
                <div className="note">{subtitle(item, ticketsByEmployee[item.employeeId] ?? [])}</div>
              </div>
              <div>
                <div className="note">{item.previewAt ? formatListTime(item.previewAt) : ""}</div>
                {item.unreadForAnalyst > 0 && <div className="unread">{item.unreadForAnalyst}</div>}
              </div>
            </button>
          ))}
          {visible.length === 0 && <p className="empty">Nenhuma conversa neste filtro.</p>}
        </div>
      </aside>
      <section className="pane">
        {selected ? (
          <>
            <header>
              <div className="pane-who">
                <button className="btn ghost back" type="button" onClick={() => setShowThread(false)}>
                  Voltar
                </button>
                <div className={`avatar ${toneClass(selected.employeeId)}`}>{selected.employeeInitials}</div>
                <div>
                <strong>{selected.employeeName}</strong>
                <div className="note">
                  {selected.employeeDepartment}
                  {featured ? ` · ${featured.code}` : ""} · {statusLabel(selected)}
                </div>
                </div>
              </div>
              <div className="actions">
                <button className="btn ghost history-toggle" type="button" aria-expanded={historyOpen} onClick={() => setHistoryOpen(true)}>
                  Chamados
                </button>
                {selected.state !== "closed" && (
                  <button className="btn ghost" type="button" disabled={busy} onClick={() => void act("return")}>
                    Devolver ao agent
                  </button>
                )}
                {mine ? (
                  <button className="btn danger" type="button" disabled={busy} onClick={() => void act("close")}>
                    Encerrar atendimento
                  </button>
                ) : (
                  selected.state !== "closed" && (
                    <button className="btn" type="button" disabled={busy || !available} onClick={() => void act("assume")}>
                      Assumir atendimento
                    </button>
                  )
                )}
              </div>
            </header>
            <Thread messages={messages} />
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}
            {mine ? (
              <form
                className="composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  void act("reply", draft);
                }}
              >
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Responder ${selected.employeeName}…`} aria-label="Resposta do analista" />
                <button className="btn" type="submit" disabled={busy || !draft.trim()}>
                  Enviar
                </button>
              </form>
            ) : (
              <div className="composer-note">Assuma o atendimento para responder</div>
            )}
          </>
        ) : (
          <p className="empty">Selecione uma conversa para atender.</p>
        )}
      </section>
      <aside className="history">
        <header>
          <div className="card-top">
            <strong>Chamados {selected ? `de ${selected.employeeName.split(" ")[0]}` : ""}</strong>
            <button className="btn ghost history-close" type="button" onClick={() => setHistoryOpen(false)}>
              Fechar
            </button>
          </div>
          <div className="note">
            {openTickets.length} abertos · {closedTickets.length} encerrados
          </div>
        </header>
        <div className="body">
          <h3>Desta conversa</h3>
          {(featured ? [featured] : []).map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} current />
          ))}
          <h3>Outros chamados</h3>
          {[...openTickets, ...closedTickets].filter((ticket) => ticket.id !== featured?.id).map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} />
          ))}
        </div>
      </aside>
    </div>
  );
}

const toneByEmployee: Record<string, string> = {
  "user-ana": "tone-blue",
  "user-carla": "tone-orange",
  "user-bruno": "tone-purple",
  "user-diego": "tone-green",
  "user-elisa": "tone-pink",
  "user-fabio": "tone-sand",
  "user-gabriela": "tone-yellow",
  "user-helena": "tone-teal",
};

const tones = ["tone-blue", "tone-orange", "tone-purple", "tone-green", "tone-pink", "tone-sand", "tone-yellow", "tone-teal"];

function toneClass(employeeId: string): string {
  const known = toneByEmployee[employeeId];
  if (known) return known;
  const index = [...employeeId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length;
  return tones[index] ?? "tone-blue";
}

function statusLabel(conversation: ConversationView): string {
  if (conversation.state === "waiting") return "Aguardando atendente";
  if (conversation.state === "with_analyst") return "Você está atendendo";
  if (conversation.state === "closed") return "Resolvida pelo agent";
  return "Agent atendendo";
}

function subtitle(conversation: ConversationView, tickets: TicketView[]): string {
  if (conversation.state === "with_agent") return "Agent atendendo";
  if (conversation.state === "closed") return "Resolvida pelo agent";
  if (conversation.transferReason === "low_confidence") {
    return `Agent pediu ajuda · confiança ${conversation.confidence ?? 0}%`;
  }
  const linked = tickets.find((ticket) => ticket.conversationId === conversation.id) ?? tickets.find((ticket) => ticket.status !== "resolved");
  if (conversation.transferReason === "same_day") return "Transferida · contato em breve";
  return linked ? `Transferida · ${linked.code}` : `Transferida · Suporte ${conversation.queue ?? "N1"}`;
}
