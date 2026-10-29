"use client";

import type { PublicUser } from "@/domain/blocks";
import { useRouter } from "next/navigation";

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
          <div className="mark">N</div>
          <div className="word">
            <strong>Nexo Assist</strong>
          </div>
        </div>
        <nav className="nav">
          <a className={active === "atendimento" ? "active" : ""} href="/atendimento">
            Atendimento
          </a>
          <a className={active === "perfil" ? "active" : ""} href="/perfil">
            Meu perfil
          </a>
        </nav>
        <div className="spacer" />
        <div className="user-card">
          <div className="avatar">{user.initials}</div>
          <div className="word">
            <b>{user.name}</b>
            <small>{user.email}</small>
          </div>
        </div>
        <button
          className="btn ghost leave"
          type="button"
          onClick={() => {
            void fetch("/api/auth/logout", { method: "POST" }).then(() => router.push("/login"));
          }}
        >
          Sair
        </button>
      </aside>
      <section className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Service desk de TI</p>
            <h1>{title}</h1>
          </div>
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
