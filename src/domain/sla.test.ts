import { describe, expect, test } from "vitest";
import { addBusinessHours, deadlineFor, fromZoned, isOverdue, zonedParts } from "./sla";

describe("prazos úteis", () => {
  test("quatro horas úteis atravessam o fim de semana", () => {
    const friday = fromZoned(2026, 10, 30, 16, 0);
    const due = addBusinessHours(friday, 4);
    const parts = zonedParts(due);
    expect(parts).toMatchObject({ year: 2026, month: 11, day: 2, hour: 10, minute: 0 });
  });

  test("prioridade crítica usa uma hora corrida, inclusive depois das 18h", () => {
    const start = fromZoned(2026, 10, 30, 17, 40);
    const due = deadlineFor("critical", start);
    expect(zonedParts(due)).toMatchObject({ hour: 18, minute: 40 });
  });

  test("prioridade média soma três dias úteis", () => {
    const tuesday = fromZoned(2026, 10, 27, 10, 0);
    const due = deadlineFor("medium", tuesday);
    expect(zonedParts(due)).toMatchObject({ year: 2026, month: 10, day: 30, hour: 10, minute: 0 });
  });

  test("sábado começa a contar na segunda", () => {
    const saturday = fromZoned(2026, 10, 31, 12, 0);
    const due = addBusinessHours(saturday, 4);
    expect(zonedParts(due)).toMatchObject({ day: 2, hour: 12, minute: 0, month: 11 });
  });

  test("vencido quando o prazo já passou", () => {
    const due = fromZoned(2026, 10, 27, 10, 0);
    expect(isOverdue(due, fromZoned(2026, 10, 28, 10, 0))).toBe(true);
  });
});
