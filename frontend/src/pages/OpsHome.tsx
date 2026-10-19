import { useMemo } from "react";
import { loadSnapshot } from "../services/api";
import { useLoad } from "../lib/hooks";
import { attentionItems, networkTotals } from "../lib/metrics";
import Hero from "../components/Hero";
import NetworkMap from "../components/NetworkMap";
import { ActivityList, AttentionList, Kpi, LoadFail, greeting } from "../components/blocks";
import { Chapter, Reveal, Skeleton, prefersReducedMotion } from "../components/ui";
import { ROLE_META } from "../lib/roles";

const STEPS = [
  ["01", "Allocate", "Each warehouse that can fulfil the order is scored on stock, priority and load. The best score wins."],
  ["02", "Lock", "The chosen inventory row is locked with SELECT … FOR UPDATE, so a competing order has to wait its turn."],
  ["03", "Re-check", "Once the lock is held, stock is checked again. If someone got there first, the order fails cleanly."],
  ["04", "Commit", "Stock is deducted, the order and audit rows are written, and the whole unit of work commits or rolls back as one."],
];

export default function OpsHome({ user, go }: { user: any; go: (p: string, ctx?: any) => void }) {
  const { data: s, error } = useLoad(loadSnapshot, [], 30000);
  const totals = useMemo(() => (s ? networkTotals(s) : null), [s]);
  const attention = useMemo(() => (s ? attentionItems(s) : []), [s]);
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
  const first = String(user.name || "").split(" ")[0] || "there";
  return (
    <>
      <Hero
        kicker="Admin · system operations"
        title="Network" script="operations"
        lead={`${greeting()}, ${first}. This is the control room: the live network, the exceptions, and the database mechanisms that keep every unit honest.`}
        variant="core" accent={ROLE_META.admin.accent}
        belt={["Allocate", "Lock", "Re-check", "Commit"]}
        chips={totals ? [{ label: "Units", value: totals.units.toLocaleString("en-IN") }, { label: "Open transfers", value: String(totals.open) }] : []}
        actions={<><button className="btn primary big" onClick={() => jump("story")}>How orders stay honest</button><button className="btn big" onClick={() => go("transfers")}>Transfers</button></>}
      />
      <LoadFail error={error} />

      <Chapter n="01" id="story" kicker="Chapter one" title="No double" em="spending" lead="When two customers reach for the same last units, the database makes one wait. This is the story behind every order." tone="pop">
        <div className="grid g4 steps4">
          {STEPS.map(([n, t, b], i) => (
            <Reveal key={n} className="card step" delay={i * 80}><span className="step-n">{n}</span><h3>{t}</h3><p>{b}</p></Reveal>
          ))}
        </div>
      </Chapter>

      <Chapter n="02" id="net" kicker="Chapter two" title="One network," em="one truth" lead="Every warehouse reads and writes the same PostgreSQL core. Dashed routes are transfers in flight." tone="ink">
        {!s || !totals ? <Skeleton rows={4} /> : (
          <>
            <div className="kpis">
              <Kpi hot label="Units on hand" value={totals.units} />
              <Kpi label="Orders" value={totals.orders} sub="live orders" delay={60} />
              <Kpi label="Warehouses" value={s.warehouses.length} delay={120} />
              <Kpi label="Products" value={s.products.length} delay={180} />
              <Kpi label="Transfers in flight" value={totals.open} delay={240} />
              <Kpi label="Low-stock lines" value={totals.low} tone={totals.low > 4 ? "bad" : totals.low ? "warn" : undefined} delay={300} />
            </div>
            <Reveal className="card map-card"><NetworkMap warehouses={s.warehouses} inventory={s.inventory} transfers={s.transfers} onSelect={(w) => go("inventory", { warehouse: w.name })} /></Reveal>
          </>
        )}
      </Chapter>

      <Chapter n="03" id="watch" kicker="Chapter three" title="Under" em="watch" lead="Overdue transfers, products about to run out, orders that stalled." tone="surface">
        {!s ? <Skeleton rows={4} /> : <AttentionList items={attention} go={go} />}
      </Chapter>

      <Chapter n="04" id="trail" kicker="Chapter four" title="The audit" em="trail" tone="ink">
        {!s ? <Skeleton rows={5} /> : <Reveal className="card"><ActivityList transactions={s.transactions} products={s.products} warehouses={s.warehouses} limit={8} /></Reveal>}
      </Chapter>
    </>
  );
}
