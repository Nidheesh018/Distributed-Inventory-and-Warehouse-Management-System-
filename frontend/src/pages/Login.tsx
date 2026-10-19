import { FormEvent, lazy, Suspense, useState } from "react";
import { login } from "../services/api";
import { DEMO_USERS, ensureDemoState, resetDemoState } from "../services/demoData";
import { Avatar, Icon, Marquee } from "../components/ui";

const HeroScene = lazy(() => import("../components/HeroScene"));

const DEMO: { key: keyof typeof DEMO_USERS; label: string; sees: string }[] = [
  { key: "owner", label: "Owner", sees: "Company analytics + every manager's scorecard" },
  { key: "manager1", label: "Manager · Hyderabad", sees: "Aarav · fast, reliable, healthy stock" },
  { key: "manager2", label: "Manager · Bengaluru", sees: "Isha · solid, one low-stock line" },
  { key: "manager3", label: "Manager · Mumbai", sees: "Kabir · slower responses, stuck orders" },
  { key: "manager4", label: "Manager · Delhi", sees: "Ananya · overdue transfers, low stock" },
  { key: "admin", label: "Admin", sees: "Operations + DBMS lab" },
  { key: "customer", label: "Customer", sees: "The shop and order history" },
];
const LIVE = [
  ["Owner", "owner@example.com", "Owner@12345"], ["Admin", "admin@example.com", "Admin@12345"],
  ["Mgr HYD", "manager.hyd@example.com", "Manager@12345"], ["Mgr BLR", "manager.blr@example.com", "Manager@12345"],
  ["Mgr MUM", "manager.mum@example.com", "Manager@12345"], ["Mgr DEL", "manager.del@example.com", "Manager@12345"],
  ["Customer", "customer1@example.com", "Customer@12345"],
];

export default function Login({ onLogin }: { onLogin: (user: any) => void }) {
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const r = await login(email, password);
      localStorage.setItem("inventory_token", r.access_token);
      localStorage.removeItem("distribustock_demo"); localStorage.removeItem("distribustock_demo_user");
      onLogin(r.user);
    } catch (err: any) { setError(err.message || "Sign-in failed"); } finally { setBusy(false); }
  }
  function enter(key: keyof typeof DEMO_USERS) {
    const user = DEMO_USERS[key];
    ensureDemoState();
    localStorage.setItem("distribustock_demo", "1"); localStorage.setItem("inventory_token", "demo-mode");
    localStorage.setItem("distribustock_demo_user", JSON.stringify(user));
    onLogin(user);
  }

  return (
    <div className="app login" data-role="owner">
      <div className="login-grid">
        <section className="login-art">
          <p className="kicker">Secure inventory network</p>
          <h1><span className="l1">Distribu</span><span className="l2">stock</span></h1>
          <p className="lead">One database, many warehouses, and a different workspace for every role that touches it.</p>
          <div className="login-stage"><Suspense fallback={null}><HeroScene variant="core" accent={0xffd23f} /></Suspense></div>
          <Marquee items={["Owner", "Manager", "Admin", "Customer", "Role-based by design"]} />
        </section>

        <section className="login-card" aria-label="Sign in">
          <div className="tabs" role="tablist" aria-label="Sign-in mode">
            <button role="tab" aria-selected={mode === "demo"} className={mode === "demo" ? "on" : ""} onClick={() => setMode("demo")}>Explore demo</button>
            <button role="tab" aria-selected={mode === "live"} className={mode === "live" ? "on" : ""} onClick={() => setMode("live")}>Live backend</button>
          </div>

          {mode === "demo" ? (
            <div role="tabpanel">
              <h2>Pick a role. See its world.</h2>
              <p className="muted">No backend, no password. Everything runs in your browser.</p>
              <ul className="rolelist">
                {DEMO.map((d) => (
                  <li key={d.key}>
                    <button onClick={() => enter(d.key)}>
                      <Avatar name={DEMO_USERS[d.key].name} size={40} />
                      <span><strong>{d.label}</strong><small>{d.sees}</small></span>
                      <Icon name="arrow" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
              <button className="linkbtn" onClick={() => { resetDemoState(); }}>Reset demo data</button>
            </div>
          ) : (
            <form role="tabpanel" onSubmit={submit}>
              <h2>Sign in to the live system</h2>
              <p className="muted">Needs the FastAPI + PostgreSQL stack running. Tap an account to fill it in.</p>
              <div className="chips" aria-label="Demo accounts">{LIVE.map(([l, e, p]) => <button type="button" className="chip" key={l} onClick={() => { setEmail(e); setPassword(p); }}>{l}</button>)}</div>
              <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" required /></label>
              <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label>
              {error && <div className="notice n-err" role="alert"><span>{error}</span></div>}
              <button className="btn primary big full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
