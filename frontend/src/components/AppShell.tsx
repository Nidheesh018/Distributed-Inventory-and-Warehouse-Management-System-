import { ReactNode, useEffect, useRef } from "react";
import { Avatar, Icon } from "./ui";
import { ROLE_META, roleOf } from "../lib/roles";

export type ShellUser = { id: number; name: string; email: string; role: string; warehouse_id?: number | null };

/**
 * One shell, four personalities. `data-role` swaps the CSS theme (accent,
 * hero colour, light/dark), so every role feels like its own product while
 * sharing one navigation pattern: floating top bar on desktop, thumb-reach
 * tab bar on phones.
 */
export default function AppShell({ user, page, go, onLogout, badges, demo, onResetDemo, warehouseName, children }: { user: ShellUser; page: string; go: (p: string) => void; onLogout: () => void; badges: Record<string, number>; demo: boolean; onResetDemo: () => void; warehouseName?: string; children: ReactNode }) {
  const role = roleOf(user.role);
  const meta = ROLE_META[role];
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    main.current?.focus({ preventScroll: true });
  }, [page]);

  return (
    <div className="app" data-role={role}>
      <a className="skip" href="#main">Skip to content</a>
      {demo && (
        <div className="demo-strip" role="note">
          <span><i className="pulse" />Offline demo · data lives in this browser</span>
          <button onClick={onResetDemo}>Reset demo data</button>
        </div>
      )}
      <header className="topbar">
        <button className="logo" onClick={() => go(meta.home)} aria-label="DistribuStock home">Distribu<b>Stock</b></button>
        <nav className="topnav" aria-label="Main">
          {meta.nav.map((n) => (
            <button key={n.key} className={`navitem${page === n.key ? " on" : ""}`} aria-current={page === n.key ? "page" : undefined} onClick={() => go(n.key)}>
              {n.label}{badges[n.key] > 0 && <b className="count" aria-label={`${badges[n.key]} need attention`}>{badges[n.key]}</b>}
            </button>
          ))}
        </nav>
        <div className="who">
          <Avatar name={user.name} size={36} />
          <span className="who-text"><strong>{user.name}</strong><small>{role === "warehouse_manager" && warehouseName ? warehouseName : meta.label}</small></span>
          <button className="signout" onClick={onLogout} aria-label="Sign out"><Icon name="out" size={18} /><span>Sign out</span></button>
        </div>
      </header>

      <main id="main" ref={main} tabIndex={-1} className="main">{children}</main>

      <footer className="foot">
        <span>DistribuStock · database-first fulfilment</span>
        <span>PostgreSQL · FastAPI · React · Three.js</span>
      </footer>

      <nav className="tabbar" aria-label="Main (mobile)">
        {meta.nav.map((n) => (
          <button key={n.key} className={page === n.key ? "on" : ""} aria-current={page === n.key ? "page" : undefined} onClick={() => go(n.key)}>
            <span className="tab-ic"><Icon name={n.icon} size={22} />{badges[n.key] > 0 && <b className="count">{badges[n.key]}</b>}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
