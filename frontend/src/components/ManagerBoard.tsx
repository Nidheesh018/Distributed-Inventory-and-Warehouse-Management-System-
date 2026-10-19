import { useState } from "react";
import { Avatar, Badge, BadgeTone, Icon, Meter, Reveal, Ring } from "./ui";
import { Radar } from "./charts";
import { ManagerScore, WEIGHTS, compactInr, dur, inr } from "../lib/metrics";

const TONE_BADGE: Record<string, BadgeTone> = { great: "good", good: "good", warn: "warn", bad: "bad" };
const SHORT = ["Fulfilment", "Stock", "Response", "Capacity"];
const pct = (v: number | null) => (v == null ? "n/a" : `${Math.round(v * 100)}%`);

export function ManagerCard({ m, open, onToggle, go }: { m: ManagerScore; open: boolean; onToggle: () => void; go: (page: string, ctx?: any) => void }) {
  const ful = m.parts[0].score;
  return (
    <article className={`mgr tone-${m.tone}${open ? " open" : ""}`}>
      <button className="mgr-head" aria-expanded={open} onClick={onToggle}>
        <span className="mgr-rank" aria-label={`Rank ${m.rank}`}>#{m.rank}</span>
        <Avatar name={m.manager} />
        <span className="mgr-id"><strong>{m.manager}</strong><small>{m.warehouse.name} · {m.warehouse.city}</small></span>
        <span className="mgr-mini">
          <span><small>Fulfilment</small><b>{pct(ful)}</b></span>
          <span><small>Avg response</small><b>{dur(m.avgResponseH)}</b></span>
          <span><small>Low-stock lines</small><b>{m.lowLines}</b></span>
        </span>
        <span className="mgr-score"><Ring value={m.score} size={74} /><Badge tone={TONE_BADGE[m.tone]}>{m.grade}</Badge></span>
        <span className="mgr-chev" aria-hidden="true"><Icon name="arrow" size={18} /></span>
      </button>

      {open && (
        <div className="mgr-body">
          <div className="mgr-parts">
            {m.parts.map((p) => (
              <div className="part" key={p.key}>
                <div className="part-top"><strong>{p.label}</strong><span className="weight">{Math.round(p.weight * 100)}% of score</span><b>{p.score == null ? "n/a" : `${Math.round(p.score * 100)}`}</b></div>
                <Meter value={(p.score ?? 0) * 100} tone={p.score == null ? "accent" : p.score >= 0.85 ? "good" : p.score >= 0.6 ? "warn" : "bad"} label={p.label} />
                <small>{p.detail}</small>
              </div>
            ))}
          </div>
          <div className="mgr-side">
            <dl className="mgr-stats">
              <div><dt>Orders handled</dt><dd>{m.orders}</dd></div>
              <div><dt>Revenue routed</dt><dd>{compactInr(m.revenue)}</dd></div>
              <div><dt>Units on hand</dt><dd>{m.units.toLocaleString("en-IN")}</dd></div>
              <div><dt>Open transfers</dt><dd>{m.openTransfers}</dd></div>
            </dl>
            <h4>What the data says</h4>
            <ul className="insights">{m.insights.map((i) => <li key={i}>{i}</li>)}</ul>
            <div className="mgr-actions">
              <button className="btn" onClick={() => go("inventory", { warehouse: m.warehouse.name })}>View their stock</button>
              <button className="btn" onClick={() => go("transfers")}>Review transfers</button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export default function ManagerBoard({ scores, go, compact = false }: { scores: ManagerScore[]; go: (page: string, ctx?: any) => void; compact?: boolean }) {
  const sorted = [...scores].sort((a, b) => a.rank - b.rank);
  const [openId, setOpenId] = useState<number | null>(compact ? null : sorted[0]?.warehouse.id ?? null);
  const [all, setAll] = useState(false);
  if (!sorted.length) return <div className="empty"><strong>No managers yet</strong><p>Assign a manager to a warehouse to see scorecards.</p></div>;
  const top = sorted[0];
  const worst = sorted[sorted.length - 1];
  const fastest = [...sorted].filter((s) => s.avgResponseH != null).sort((a, b) => (a.avgResponseH as number) - (b.avgResponseH as number))[0];
  const avg = Math.round(sorted.reduce((s, m) => s + m.score, 0) / sorted.length);

  return (
    <div className="board">
      <div className="board-top">
        <Reveal className="spot spot-top">
          <p className="kicker">Top performer</p>
          <div className="spot-who"><Avatar name={top.manager} size={52} /><div><strong>{top.manager}</strong><small>{top.warehouse.name}</small></div></div>
          <div className="spot-num"><b>{top.score}</b><span>/100 · {top.grade}</span></div>
        </Reveal>
        <Reveal className={`spot spot-low tone-${worst.tone}`} delay={80}>
          <p className="kicker">Needs the most support</p>
          <div className="spot-who"><Avatar name={worst.manager} size={52} /><div><strong>{worst.manager}</strong><small>{worst.warehouse.name}</small></div></div>
          <div className="spot-num"><b>{worst.score}</b><span>/100 · {worst.insights[0]}</span></div>
        </Reveal>
        <Reveal className="spot" delay={160}>
          <p className="kicker">Fastest to respond</p>
          <div className="spot-who"><Avatar name={fastest?.manager ?? "—"} size={52} /><div><strong>{fastest?.manager ?? "No data yet"}</strong><small>{fastest?.warehouse.name ?? "No transfer actions recorded"}</small></div></div>
          <div className="spot-num"><b>{dur(fastest?.avgResponseH ?? null)}</b><span>avg time to act · network avg score {avg}</span></div>
        </Reveal>
      </div>

      <div className="board-main">
        <Reveal className="card radar-card">
          <h3>Strengths at a glance</h3>
          <p className="muted">Each axis is scored 0–100. A bigger, rounder shape is a more balanced manager.</p>
          <Radar label="Manager comparison radar chart" axes={SHORT} series={sorted.map((m) => ({ name: `${m.manager.split(" ")[0]} · ${m.warehouse.code}`, values: m.parts.map((p) => Math.round((p.score ?? 0) * 100)) }))} />
        </Reveal>

        <div className="mgr-list">
          <div className="mgr-list-head">
            <h3>Leaderboard</h3>
            {!compact && <button className="btn ghost" onClick={() => { const next = !all; setAll(next); setOpenId(next ? -1 : null); }}>{all ? "Collapse all" : "Expand all"}</button>}
          </div>
          {sorted.map((m, i) => (
            <Reveal key={m.warehouse.id} delay={i * 60}>
              <ManagerCard m={m} open={all || openId === m.warehouse.id} onToggle={() => { setAll(false); setOpenId(openId === m.warehouse.id ? null : m.warehouse.id); }} go={go} />
            </Reveal>
          ))}
        </div>
      </div>

      {!compact && <Methodology scores={sorted} />}
    </div>
  );
}

export function Methodology({ scores }: { scores: ManagerScore[] }) {
  return (
    <div className="method">
      <Reveal className="card">
        <h3>Side-by-side</h3>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Manager</th><th>Score</th><th>Orders</th><th>Fulfilment</th><th>Revenue</th><th>Avg response</th><th>Overdue</th><th>Low stock</th><th>Capacity</th></tr></thead>
            <tbody>
              {scores.map((m) => (
                <tr key={m.warehouse.id}>
                  <td><strong>{m.manager}</strong><br /><small className="muted">{m.warehouse.code}</small></td>
                  <td><Badge tone={TONE_BADGE[m.tone]}>{m.score}</Badge></td>
                  <td>{m.orders}</td><td>{pct(m.parts[0].score)}</td><td>{inr(m.revenue)}</td><td>{dur(m.avgResponseH)}</td>
                  <td>{m.overdue ? <Badge tone="bad">{m.overdue}</Badge> : "0"}</td><td>{m.lowLines}</td><td>{m.utilization == null ? "n/a" : `${Math.round(m.utilization * 100)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
      <Reveal className="card" delay={80}>
        <h3>How the score is calculated</h3>
        <p className="muted">Every score is computed live from orders, stock and transfer timestamps, with no manual ratings. Weights are fixed so managers are always compared on the same rules.</p>
        <ul className="rules">
          <li><b>{Math.round(WEIGHTS.fulfilment * 100)}%</b><div><strong>Order fulfilment</strong><span>Completed orders ÷ all non-cancelled orders routed to the warehouse.</span></div></li>
          <li><b>{Math.round(WEIGHTS.stock * 100)}%</b><div><strong>Stock health</strong><span>Share of product lines above their reorder level.</span></div></li>
          <li><b>{Math.round(WEIGHTS.response * 100)}%</b><div><strong>Transfer response time</strong><span>Average hours to approve, dispatch or receive when it is their turn. Full marks within 4h, falling to zero by 48h; each item overdue (24h+) costs 8 points.</span></div></li>
          <li><b>{Math.round(WEIGHTS.utilization * 100)}%</b><div><strong>Capacity balance</strong><span>Full marks between 45% and 85% full; penalised when nearly empty or overloaded.</span></div></li>
        </ul>
        <p className="muted">If a metric has no data yet (for example, no transfers), it is left out and the remaining weights are rescaled, so new managers are not punished for missing history.</p>
      </Reveal>
    </div>
  );
}
