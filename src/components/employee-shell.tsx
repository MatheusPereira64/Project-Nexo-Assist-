"use client";

import type { PublicUser } from "@/domain/blocks";
import { useRouter } from "next/navigation";
import { IconAtendimento, IconPerfil, IconSair, Mark } from "./icons";

export function EmployeeShell({
  user,
  active,
  title,
  presence,
  children,
}: {
  user: PublicUser;
  active: "atendimento" | "perfil";
  title: string;
  presence: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Mark />
          <div className="word">
            <strong>Nexo Assist</strong>
          </div>
        </div>
        <nav className="nav">
          <a className={active === "atendimento" ? "active" : ""} href="/atendimento" aria-label="Atendimento" title="Atendimento">
            <IconAtendimento />
            <span className="nav-label">Atendimento</span>
          </a>
          <a className={active === "perfil" ? "active" : ""} href="/perfil" aria-label="Meu perfil" title="Meu perfil">
            <IconPerfil />
            <span className="nav-label">Meu perfil</span>
          </a>
        </nav>
        <div className="spacer" />
        <div className="user-card">
          <div className="avatar">{user.initials}</div>
          <div className="word">
            <b>{user.name}</b>
            <small title={user.email}>{user.email}</small>
          </div>
        </div>
        <button
          className="btn ghost leave"
          type="button"
          aria-label="Sair"
          title="Sair"
          onClick={() => {
            void fetch("/api/auth/logout", { method: "POST" }).then(() => router.push("/login"));
          }}
        >
          <IconSair />
          <span className="leave-label">Sair</span>
        </button>
      </aside>
      <section className="main">
        <header className="topbar">
          <nav className="crumb" aria-label="Localização">
            <span>Service desk de TI</span>
            <span aria-hidden="true">›</span>
            <h1>{title}</h1>
          </nav>
          <div className={presence.includes("Aguardando") ? "presence" : "presence"}>
            <span className={presence.includes("Aguardando") ? "dot warn" : presence.includes("atendendo") ? "dot busy" : "dot"} />
            {presence}
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}
