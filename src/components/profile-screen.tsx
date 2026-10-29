"use client";

import { useState } from "react";
import type { PublicUser } from "@/domain/blocks";
import { EmployeeShell } from "./employee-shell";
import { IconKey, IconLock, IconMail } from "./icons";

export function ProfileScreen({ user }: { user: PublicUser }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const days = Math.max(1, Math.round((Date.now() - new Date(user.passwordChangedAt).getTime()) / (24 * 60 * 60 * 1000)));

  return (
    <EmployeeShell user={user} active="perfil" title="Meu perfil" presence="Conta corporativa">
      <section className="profile">
        <h2>Meu perfil</h2>
        <p className="note">Seus dados de acesso ao service desk de TI.</p>

        <article className="profile-card">
          <div className="profile-row">
            <span>Nome</span>
            <strong>{user.name}</strong>
          </div>
          <div className="profile-row">
            <span className="with-icon">
              <IconMail />
              E-mail corporativo
            </span>
            <strong>{user.email}</strong>
            <span className="managed">
              <IconLock />
              Gerenciado pela TI
            </span>
          </div>
        </article>

        <article className="profile-card">
          <div className="password-row">
            <span className="icon-bubble" aria-hidden="true">
              <IconKey />
            </span>
            <div>
              <strong>Senha</strong>
              <div className="note">Alterada há {days} dias</div>
            </div>
            <button
              className="btn ghost slim"
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
              <IconKey />
              {pending ? "Enviando…" : "Redefinir senha"}
            </button>
          </div>
          <p className="profile-foot">
            <IconMail />
            <span>{message ?? `Enviaremos um link de redefinição para ${user.email}.`}</span>
          </p>
        </article>
      </section>
    </EmployeeShell>
  );
}
