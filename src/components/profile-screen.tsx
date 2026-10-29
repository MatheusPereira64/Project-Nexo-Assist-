"use client";

import { useState } from "react";
import type { PublicUser } from "@/domain/blocks";
import { EmployeeShell } from "./employee-shell";

export function ProfileScreen({ user }: { user: PublicUser }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const days = Math.max(1, Math.round((Date.now() - new Date(user.passwordChangedAt).getTime()) / (24 * 60 * 60 * 1000)));

  return (
    <EmployeeShell user={user} active="perfil" title="Meu perfil" presence="Conta corporativa">
      <section className="profile">
        <h2>Meu perfil</h2>
        <p className="note">Seus dados de acesso ao service desk de TI.</p>
        <label className="field">
          <span>Nome</span>
          <input value={user.name} readOnly />
        </label>
        <label className="field">
          <span>E-mail corporativo</span>
          <input value={user.email} readOnly />
        </label>
        <p className="note">Gerenciado pela TI</p>
        <div className="locked">
          <div className="card-top">
            <div>
              <strong>Senha</strong>
              <div className="note">Alterada há {days} dias</div>
            </div>
            <button
              className="btn ghost"
              type="button"
              disabled={pending}
              onClick={() => {
                setPending(true);
                void fetch("/api/profile", { method: "POST" })
                  .then((response) => response.json())
                  .then((data: { message?: string; error?: string }) => setMessage(data.message ?? data.error ?? "Não foi possível agora."))
                  .finally(() => setPending(false));
              }}
            >
              Redefinir senha
            </button>
          </div>
          <p className="note">{message ?? `Enviaremos um link de redefinição para ${user.email}.`}</p>
        </div>
      </section>
    </EmployeeShell>
  );
}
