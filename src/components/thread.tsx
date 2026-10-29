"use client";

import type { Block, DraftView, MessageView } from "@/domain/blocks";
import type { DraftInput } from "@/domain/policy";
import { PRIORITY_LABEL } from "@/domain/types";
import { formatClock, formatDeadline } from "@/lib/format";
import { TicketCard } from "./ticket-card";

export function Thread({
  messages,
  interactive = false,
  onChoice,
  onAction,
  onDraft,
}: {
  messages: MessageView[];
  interactive?: boolean;
  onChoice?: (label: string) => void;
  onAction?: (id: string) => void;
  onDraft?: (draftId: string, action: "confirm" | "cancel" | "edit", patch?: Partial<DraftInput>) => void;
}) {
  return (
    <div className="thread">
      {messages.map((message) => {
        if (message.role === "system") {
          return (
            <div key={message.id} className="system-line">
              {message.content} · {formatClock(message.createdAt)}
            </div>
          );
        }
        const mine = message.role === "user";
        return (
          <article key={message.id} className={mine ? "msg user" : "msg"}>
            {!mine && message.chips.length > 0 && (
              <div className="chips">
                {message.chips.map((chip) => (
                  <span key={chip} className="chip">
                    {chip}
                  </span>
                ))}
              </div>
            )}
            <div className={`bubble ${message.role}`}>
              {!mine && (
                <div className="who">
                  <span>
                    {message.authorName}
                    {message.role === "assistant" ? " · IA" : ""}
                  </span>
                  <span>{formatClock(message.createdAt)}</span>
                </div>
              )}
              {message.content}
            </div>
            {message.trace && (
              <details className="trace">
                <summary>Ver decisão</summary>
                <dl>
                  <div>
                    <dt>Entendeu</dt>
                    <dd>{message.trace.understood}</dd>
                  </div>
                  <div>
                    <dt>Ação</dt>
                    <dd>{message.trace.action}</dd>
                  </div>
                  <div>
                    <dt>Confiança</dt>
                    <dd>{message.trace.confidence}%</dd>
                  </div>
                  <div>
                    <dt>Por quê</dt>
                    <dd>{message.trace.reason}</dd>
                  </div>
                </dl>
              </details>
            )}
            {message.blocks.map((block, index) => (
              <BlockView
                key={`${message.id}-${index}`}
                block={block}
                interactive={interactive}
                onChoice={onChoice}
                onAction={onAction}
                onDraft={onDraft}
              />
            ))}
          </article>
        );
      })}
    </div>
  );
}

function BlockView({
  block,
  interactive,
  onChoice,
  onAction,
  onDraft,
}: {
  block: Block;
  interactive: boolean;
  onChoice?: (label: string) => void;
  onAction?: (id: string) => void;
  onDraft?: (draftId: string, action: "confirm" | "cancel" | "edit", patch?: Partial<DraftInput>) => void;
}) {
  if (block.type === "tickets") {
    return (
      <div className="stack">
        {block.tickets.map((ticket) => (
          <button key={ticket.code} className="choice" type="button" disabled={!interactive} onClick={() => onChoice?.(`${ticket.code} · ${ticket.title}`)}>
            {ticket.code} · {ticket.title}
          </button>
        ))}
      </div>
    );
  }
  if (block.type === "ticket") return <TicketCard ticket={block.ticket} />;
  if (block.type === "choices") {
    return (
      <div className="choice-row">
        {block.options.map((option) => (
          <button key={option.id} className="choice" type="button" disabled={!interactive} onClick={() => onChoice?.(option.label)}>
            {option.label}
          </button>
        ))}
      </div>
    );
  }
  if (block.type === "actions") {
    return (
      <div className="actions">
        {block.actions.map((action) => (
          <button key={action.id} className={action.id === "transfer" ? "btn" : "btn ghost"} type="button" disabled={!interactive} onClick={() => onAction?.(action.id)}>
            {action.label}
          </button>
        ))}
      </div>
    );
  }
  return <DraftCard draft={block.draft} interactive={interactive} onDraft={onDraft} />;
}

function DraftCard({
  draft,
  interactive,
  onDraft,
}: {
  draft: DraftView;
  interactive: boolean;
  onDraft?: (draftId: string, action: "confirm" | "cancel" | "edit", patch?: Partial<DraftInput>) => void;
}) {
  return (
    <form
      className="draft"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onDraft?.(draft.draftId, "edit", {
          title: String(data.get("title") ?? ""),
          description: String(data.get("description") ?? ""),
        });
      }}
    >
      <div className="draft-head">
        <div>
          <div className="eyebrow">Novo chamado</div>
          <strong>Rascunho {draft.code}</strong>
        </div>
        <span className="badge">{draft.status === "pending" ? "Aguardando confirmação" : draft.status === "confirmed" ? "Confirmado" : "Cancelado"}</span>
      </div>
      {draft.status === "pending" && interactive ? (
        <>
          <input name="title" defaultValue={draft.title} aria-label="Título" />
          <textarea name="description" defaultValue={draft.description} aria-label="Descrição" />
        </>
      ) : (
        <>
          <h3>{draft.title}</h3>
          <p>{draft.description}</p>
        </>
      )}
      <div className="grid-2">
        <div>
          <span>Categoria</span>
          <strong>{draft.category}</strong>
        </div>
        <div>
          <span>Prioridade</span>
          <strong>
            {PRIORITY_LABEL[draft.priority]} · resposta até {formatDeadline(draft.dueAt)}
          </strong>
        </div>
        <div>
          <span>Afetados</span>
          <strong>{draft.affectedLabel}</strong>
        </div>
        {draft.resultCode && (
          <div>
            <span>Chamado</span>
            <strong className="mono">{draft.resultCode}</strong>
          </div>
        )}
      </div>
      {draft.status === "pending" && interactive && (
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn" type="button" onClick={() => onDraft?.(draft.draftId, "confirm")}>
            Confirmar
          </button>
          <button className="btn ghost" type="submit">
            Editar
          </button>
          <button className="btn ghost" type="button" onClick={() => onDraft?.(draft.draftId, "cancel")}>
            Cancelar
          </button>
        </div>
      )}
    </form>
  );
}
