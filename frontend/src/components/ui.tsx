import { ReactNode, useEffect, useRef, useState } from "react";

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- icons (24px, stroke) ---------- */
const ICONS: Record<string, string> = {
  grid: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  users: "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16.5 4.6a3.5 3.5 0 010 6.8M18 14.8c1.8.7 3 2.4 3.5 5.2",
  building: "M3 21V9l9-5 9 5v12M3 21h18M8 21v-6h8v6M7 12h2M11 12h2M15 12h2",
  box: "M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5L12 12l8.5-4.5M12 12v9",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  swap: "M4 8h14l-3-3M20 16H6l3 3",
  db: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  bag: "M5 8h14l-1 12H6zM9 8V6a3 3 0 016 0v2",
  out: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9",
  arrow: "M5 12h14M13 6l6 6-6 6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  alert: "M12 4l9 16H3zM12 10v4M12 17.5v.5",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name] || ICONS.grid} />
    </svg>
  );
}

/* ---------- scroll reveal ---------- */
export function Reveal({ children, className = "", delay = 0, as = "div" }: { children: ReactNode; className?: string; delay?: number; as?: string }) {
  const ref = useRef<HTMLElement | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.08, rootMargin: "0px 0px -4% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Tag: any = as;
  return <Tag ref={ref} className={`reveal${on ? " in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</Tag>;
}

/* ---------- count-up number ---------- */
export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [n, setN] = useState(0);
  const fmt = format || ((x: number) => Math.round(x).toLocaleString("en-IN"));
  useEffect(() => {
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) { setN(value); return; }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const run = (t: number) => {
        const k = Math.min(1, (t - t0) / 1100);
        setN(value * (1 - Math.pow(1 - k, 4)));
        if (k < 1) raf = requestAnimationFrame(run);
      };
      raf = requestAnimationFrame(run);
    }, { threshold: 0.3 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]);
  return <span ref={ref}>{fmt(n)}</span>;
}

/* ---------- small atoms ---------- */
export type BadgeTone = "good" | "warn" | "bad" | "info" | "plain";
export function Badge({ tone = "plain", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge b-${tone}`}>{children}</span>;
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const ini = (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">{ini}</span>;
}

export function Meter({ value, tone = "accent", label }: { value: number; tone?: "accent" | "good" | "warn" | "bad"; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return <div className={`meter m-${tone}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}><i style={{ width: `${v}%` }} /></div>;
}

export function Ring({ value, size = 120, label, sub }: { value: number; size?: number; label?: string; sub?: string }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"} ${Math.round(v)} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-val" strokeDasharray={`${(c * v) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring-text"><strong style={{ fontSize: size * 0.3 }}>{Math.round(v)}</strong>{sub && <small>{sub}</small>}</div>
    </div>
  );
}

export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items, ...items, ...items];
  return (
    <div className="belt" aria-hidden="true">
      <div>{[0, 1].map((k) => <span className="belt-row" key={k}>{row.map((s, i) => <span key={i}>{s}<b>✦</b></span>)}</span>)}</div>
    </div>
  );
}

/* ---------- structure ---------- */
export function Chapter({ n, kicker, title, em, lead, tone = "ink", id, children, actions }: { n: string; kicker?: string; title: string; em?: string; lead?: string; tone?: "ink" | "surface" | "accent" | "pop"; id?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className={`chapter ch-${tone}`} id={id}>
      <div className="wrap">
        <Reveal className="ch-head">
          <span className="ch-num" aria-hidden="true">{n}</span>
          <div className="ch-text">
            {kicker && <p className="kicker">{kicker}</p>}
            <h2>{title} {em && <em>{em}</em>}</h2>
            {lead && <p className="lead">{lead}</p>}
          </div>
          {actions && <div className="ch-actions">{actions}</div>}
        </Reveal>
        {children}
      </div>
    </section>
  );
}

export function PageHead({ kicker, title, em, lead, children }: { kicker: string; title: string; em?: string; lead?: string; children?: ReactNode }) {
  return (
    <header className="pagehead">
      <div>
        <p className="kicker">{kicker}</p>
        <h1>{title} {em && <em>{em}</em>}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {children && <div className="pagehead-actions">{children}</div>}
    </header>
  );
}

export function Empty({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return <div className="empty"><strong>{title}</strong>{body && <p>{body}</p>}{children}</div>;
}

export function Notice({ kind = "ok", children, onClose }: { kind?: "ok" | "err"; children: ReactNode; onClose?: () => void }) {
  return (
    <div className={`notice n-${kind}`} role={kind === "err" ? "alert" : "status"}>
      <span>{children}</span>
      {onClose && <button type="button" className="notice-x" onClick={onClose} aria-label="Dismiss"><Icon name="close" size={16} /></button>}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="skeleton" aria-busy="true" aria-label="Loading">{Array.from({ length: rows }, (_, i) => <i key={i} style={{ width: `${92 - i * 11}%` }} />)}</div>;
}

export function Chips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { v: T; label: string; count?: number }[]; label: string }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.v} className={`chip${value === o.v ? " on" : ""}`} aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
          {o.label}{o.count != null && <b>{o.count}</b>}
        </button>
      ))}
    </div>
  );
}
