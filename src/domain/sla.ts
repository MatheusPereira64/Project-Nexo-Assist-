import type { Priority } from "./types";

/** Horário de Brasília, sem horário de verão. */
const BRT_OFFSET_HOURS = 3;
const OPEN_HOUR = 8;
const CLOSE_HOUR = 18;

export type Zoned = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

export function zonedParts(date: Date): Zoned {
  const brt = new Date(date.getTime() - BRT_OFFSET_HOURS * 60 * 60 * 1000);
  return {
    year: brt.getUTCFullYear(),
    month: brt.getUTCMonth() + 1,
    day: brt.getUTCDate(),
    hour: brt.getUTCHours(),
    minute: brt.getUTCMinutes(),
    weekday: brt.getUTCDay(),
  };
}

export function fromZoned(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour + BRT_OFFSET_HOURS, minute, 0, 0));
}

function isWeekend(weekday: number): boolean {
  return weekday === 0 || weekday === 6;
}

function isOpen(parts: Zoned): boolean {
  if (isWeekend(parts.weekday)) return false;
  const minutes = parts.hour * 60 + parts.minute;
  return minutes >= OPEN_HOUR * 60 && minutes < CLOSE_HOUR * 60;
}

function nextOpen(date: Date): Date {
  const parts = zonedParts(date);
  let { year, month, day, hour, minute } = parts;
  if (!isWeekend(parts.weekday) && hour * 60 + minute < OPEN_HOUR * 60) {
    return fromZoned(year, month, day, OPEN_HOUR, 0);
  }
  const cursor = fromZoned(year, month, day, 12, 0);
  for (let i = 1; i <= 7; i += 1) {
    const next = new Date(cursor.getTime() + i * 24 * 60 * 60 * 1000);
    const z = zonedParts(next);
    if (!isWeekend(z.weekday)) return fromZoned(z.year, z.month, z.day, OPEN_HOUR, 0);
  }
  return date;
}

export function alignToBusiness(date: Date): Date {
  const parts = zonedParts(date);
  if (isOpen(parts)) return date;
  return nextOpen(date);
}

export function addBusinessHours(from: Date, hours: number): Date {
  let cursor = alignToBusiness(from);
  let remaining = Math.round(hours * 60);
  while (remaining > 0) {
    const parts = zonedParts(cursor);
    if (!isOpen(parts)) {
      cursor = nextOpen(cursor);
      continue;
    }
    const used = parts.hour * 60 + parts.minute;
    const leftToday = CLOSE_HOUR * 60 - used;
    const step = Math.min(remaining, leftToday);
    cursor = new Date(cursor.getTime() + step * 60 * 1000);
    remaining -= step;
    if (remaining > 0) cursor = nextOpen(cursor);
  }
  return cursor;
}

export function addBusinessDays(from: Date, days: number): Date {
  const aligned = alignToBusiness(from);
  const start = zonedParts(aligned);
  let cursor = fromZoned(start.year, start.month, start.day, start.hour, start.minute);
  let left = days;
  while (left > 0) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    if (!isWeekend(zonedParts(cursor).weekday)) left -= 1;
  }
  const end = zonedParts(cursor);
  const hour = start.hour < OPEN_HOUR || start.hour >= CLOSE_HOUR ? OPEN_HOUR : start.hour;
  const minute = hour === OPEN_HOUR && start.hour !== OPEN_HOUR ? 0 : start.minute;
  return fromZoned(end.year, end.month, end.day, hour, minute);
}

export function deadlineFor(priority: Priority, from: Date): Date {
  if (priority === "critical") return new Date(from.getTime() + 60 * 60 * 1000);
  if (priority === "high") return addBusinessHours(from, 4);
  if (priority === "medium") return addBusinessDays(from, 3);
  return addBusinessDays(from, 5);
}

export function isOverdue(dueAt: string | Date, now: Date): boolean {
  return new Date(dueAt).getTime() < now.getTime();
}

export function priorityWindowLabel(priority: Priority): string {
  if (priority === "critical") return "1 hora";
  if (priority === "high") return "4 horas úteis";
  if (priority === "medium") return "3 dias úteis";
  return "5 dias úteis";
}
