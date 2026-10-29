const TIME_ZONE = "America/Sao_Paulo";

export function formatClock(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(new Date(iso));
}

function dayKey(isoOrDate: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate,
  );
}

export function formatListTime(iso: string, now = new Date()): string {
  const key = dayKey(iso);
  if (key === dayKey(now)) {
    const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
    if (minutes >= 0 && minutes < 2) return "agora";
    return formatClock(iso);
  }
  if (key === dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return "ontem";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: TIME_ZONE })
    .format(new Date(iso))
    .replace(".", "");
}

export function formatOpened(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  })
    .format(new Date(iso))
    .replace(".", "")
    .replace(",", "");
}

export function formatRelative(iso: string, now = new Date()): string {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "há 1 dia";
  if (days >= 6 && days <= 8) return "há 1 semana";
  return `há ${days} dias`;
}

export function formatDeadline(iso: string): string {
  return formatClock(iso);
}

export function daysSinceLabel(iso: string, now = new Date()): string {
  const days = Math.max(1, Math.round((now.getTime() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000)));
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}
