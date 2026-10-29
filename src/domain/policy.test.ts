import { describe, expect, test } from "vitest";
import {
  classifyPriority,
  duplicateDecision,
  isOutOfScope,
  shouldTransfer,
  textOverlap,
  userAskedForAnalyst,
} from "./policy";

const now = new Date("2026-10-28T15:00:00.000Z");

describe("prioridade", () => {
  test("equipe parada é crítica", () => {
    expect(classifyPriority({ impact: "company", stopped: true, blocksWork: true, sameDayCommitment: false, kind: "incident" })).toBe("critical");
  });

  test("compromisso no mesmo dia é alta", () => {
    expect(classifyPriority({ impact: "only_me", stopped: true, blocksWork: true, sameDayCommitment: true, kind: "incident" })).toBe("high");
  });

  test("pedido sem urgência é baixa", () => {
    expect(classifyPriority({ impact: "only_me", stopped: false, blocksWork: false, sameDayCommitment: false, kind: "request" })).toBe("low");
  });

  test("incidente com alternativa é média", () => {
    expect(classifyPriority({ impact: "only_me", stopped: false, blocksWork: false, sameDayCommitment: false, kind: "incident" })).toBe("medium");
  });
});

describe("escopo e transferência", () => {
  test("férias sem sinal de TI fica fora", () => {
    expect(isOutOfScope("quero marcar férias para dezembro")).toBe(true);
  });

  test("pasta do financeiro no SharePoint é TI", () => {
    expect(isOutOfScope("não entro na pasta Financeiro do SharePoint")).toBe(false);
  });

  test("pedido de analista, caso crítico, vencido ou baixa confiança transferem", () => {
    expect(userAskedForAnalyst("quero falar com um analista")).toBe(true);
    expect(shouldTransfer({ userAsked: true, priority: "low", overdue: false, confidence: 90 })).toBe(true);
    expect(shouldTransfer({ userAsked: false, priority: "critical", overdue: false, confidence: 90 })).toBe(true);
    expect(shouldTransfer({ userAsked: false, priority: "medium", overdue: true, confidence: 90 })).toBe(true);
    expect(shouldTransfer({ userAsked: false, priority: "medium", overdue: false, confidence: 41 })).toBe(true);
    expect(shouldTransfer({ userAsked: false, priority: "medium", overdue: false, confidence: 80 })).toBe(false);
  });
});

describe("duplicidade", () => {
  test("chamado aberto parecido é atualizado", () => {
    const decision = duplicateDecision(
      {
        id: "t",
        requesterId: "ana",
        status: "waiting_analyst",
        category: "Hardware",
        title: "Notebook lento após atualização do Windows",
        description: "Lentidão geral desde a atualização.",
        resolvedAt: null,
      },
      {
        requesterId: "ana",
        category: "Hardware",
        title: "Notebook continua lento depois da atualização",
        description: "Ainda está lento após o Windows.",
      },
      now,
    );
    expect(decision).toBe("update");
    expect(textOverlap("notebook lento atualização", "notebook lento windows")).toBeGreaterThan(0);
  });

  test("resolvido há quatro dias pode ser reaberto", () => {
    expect(
      duplicateDecision(
        {
          id: "t",
          requesterId: "bruno",
          status: "resolved",
          category: "Acesso",
          title: "Senha do SAP bloqueada",
          description: "Usuário bloqueado no SAP.",
          resolvedAt: "2026-10-24T15:00:00.000Z",
        },
        { requesterId: "bruno", category: "Acesso", title: "Senha do SAP bloqueada de novo", description: "Bloqueio no SAP outra vez." },
        now,
      ),
    ).toBe("reopen");
  });

  test("resolvido há meses gera outro chamado", () => {
    expect(
      duplicateDecision(
        {
          id: "t",
          requesterId: "ana",
          status: "resolved",
          category: "Acesso",
          title: "Troca de senha da rede",
          description: "Senha da rede expirou.",
          resolvedAt: "2026-07-11T16:00:00.000Z",
        },
        { requesterId: "ana", category: "Acesso", title: "Troca de senha da rede", description: "A senha da rede expirou de novo." },
        now,
      ),
    ).toBe("create");
  });

  test("chamado de outra pessoa não é duplicata", () => {
    expect(
      duplicateDecision(
        {
          id: "t",
          requesterId: "bruno",
          status: "open",
          category: "Acesso",
          title: "Senha do SAP bloqueada",
          description: "SAP",
          resolvedAt: null,
        },
        { requesterId: "ana", category: "Acesso", title: "Senha do SAP bloqueada", description: "SAP" },
        now,
      ),
    ).toBe("create");
  });
});
