"use client";

import { useEffect, useRef, useState } from "react";
import { Mark } from "./icons";

export function LoginScreen() {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const privacyButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (privacy && !dialog.open) dialog.showModal();
    if (!privacy && dialog.open) dialog.close();
  }, [privacy]);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
        keepConnected: formData.get("keep") === "on",
      }),
    });
    const data = (await response.json()) as { error?: string; redirectTo?: string };
    setPending(false);
    if (!response.ok || !data.redirectTo) {
      setError(data.error ?? "Não foi possível entrar.");
      return;
    }
    window.location.href = data.redirectTo;
  }

  async function forgot(event: React.MouseEvent) {
    event.preventDefault();
    const email = (document.getElementById("email") as HTMLInputElement | null)?.value ?? "";
    const response = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await response.json()) as { message: string };
    setNotice(data.message);
  }

  return (
    <main className="login">
      <section className="showcase">
        <div className="brand">
          <Mark />
          <div>
            <strong>Nexo Assist</strong>
            <small>Service desk de TI da Nexo</small>
          </div>
        </div>
        <div className="story">
          <h1>Seu problema de TI, resolvido em uma conversa.</h1>
          <p className="lede">
            Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central de ajuda e chama um analista quando precisa.
          </p>
          <div className="sample" aria-hidden="true">
            <div className="bubble user">Meu notebook não conecta na VPN. Erro 809.</div>
            <div className="bubble agent">
              <div className="who">
                <span>Nexo Assist</span>
                <span>consultou seus chamados · criou um chamado</span>
              </div>
              Pronto: abri o chamado com prioridade alta. Um analista fala com você em até 4 h úteis.
            </div>
            <div className="ticket-pill">
              <div>
                <b>INC-20517</b>
                <div>Rede e VPN · Alta · em até 4 h</div>
              </div>
            </div>
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <strong>8 s</strong>
            <span>primeira resposta, em média</span>
          </div>
          <div className="stat">
            <strong>72%</strong>
            <span>resolvidos sem fila</span>
          </div>
          <div className="stat">
            <strong>6</strong>
            <span>analistas online agora</span>
          </div>
        </div>
      </section>
      <section className="signin">
        <div className="signin-help">
          Problema para entrar?
          <br />
          <b>Ligue no ramal 4000</b>
        </div>
        <div className="signin-center">
          <h2>Entrar</h2>
          <p className="note">Use seu e-mail corporativo e a senha da rede Nexo. Neste protótipo, qualquer senha serve.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void onSubmit(new FormData(event.currentTarget));
            }}
          >
            <label className="field">
              <span>E-mail corporativo</span>
              <input id="email" name="email" type="email" required placeholder="matheus.pereira@nexo.com.br" autoComplete="username" />
            </label>
            <label className="field">
              <span className="row-between">
                Senha
                <button className="linkish" type="button" onClick={(event) => void forgot(event)}>
                  Esqueci minha senha
                </button>
              </span>
              <input name="password" type="password" required placeholder="••••••••••" autoComplete="current-password" />
            </label>
            <label className="check">
              <input name="keep" type="checkbox" />
              Manter conectado neste computador
            </label>
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}
            {notice && <p className="note">{notice}</p>}
            <button className="btn block" type="submit" disabled={pending}>
              {pending ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
        <footer className="signin-foot">
          <span>© 2026 Nexo · Service desk de TI</span>
          <button ref={privacyButtonRef} className="linkish" type="button" onClick={() => setPrivacy(true)}>
            Privacidade e uso de dados
          </button>
        </footer>
      </section>
      <dialog
        ref={dialogRef}
        className="dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") dialogRef.current?.close();
        }}
        onClose={() => {
          setPrivacy(false);
          privacyButtonRef.current?.focus();
        }}
      >
        <h3>Privacidade</h3>
        <p className="note">
          O Nexo Assist só consulta chamados de quem está na conversa. Um funcionário não vê chamados de outro. Analistas enxergam os chamados da pessoa que estão atendendo.
        </p>
        <button className="btn" type="button" onClick={() => dialogRef.current?.close()}>
          Fechar
        </button>
      </dialog>
    </main>
  );
}
