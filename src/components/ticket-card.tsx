import type { TicketView } from "@/domain/blocks";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/domain/types";
import { formatOpened, formatRelative } from "@/lib/format";

export function TicketCard({ ticket }: { ticket: TicketView }) {
  return (
    <article className="card">
      <div className="card-top">
        <b className="mono">{ticket.code}</b>
        <span className={`badge ${ticket.status}`}>{STATUS_LABEL[ticket.status]}</span>
      </div>
      <h3>{ticket.title}</h3>
      <p>{ticket.description}</p>
      <div className="grid-2">
        <div>
          <span>Categoria</span>
          <strong>
            {ticket.category}
            {ticket.subcategory ? ` › ${ticket.subcategory}` : ""}
          </strong>
        </div>
        <div>
          <span>Prioridade</span>
          <strong className={ticket.overdue ? "badge overdue" : ""}>{PRIORITY_LABEL[ticket.priority]}</strong>
        </div>
        <div>
          <span>Aberto em</span>
          <strong>{formatOpened(ticket.openedAt)}</strong>
        </div>
        <div>
          <span>Última atualização</span>
          <strong>
            {formatRelative(ticket.updatedAt)}
            {ticket.overdue ? " · prazo vencido" : ""}
          </strong>
        </div>
      </div>
    </article>
  );
}

export function TicketRow({ ticket, current = false }: { ticket: TicketView; current?: boolean }) {
  return (
    <div className={current ? "mini current" : "mini"}>
      <b>{ticket.title}</b>
      <span className="note">
        {ticket.code} · {STATUS_LABEL[ticket.status]}
        {ticket.overdue ? " · prazo vencido" : ""}
      </span>
    </div>
  );
}
