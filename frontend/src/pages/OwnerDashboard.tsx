import { useMemo } from "react";
import { loadSnapshot } from "../services/api";
import { useLoad } from "../lib/hooks";
import { attentionItems, compactInr, inr, networkTotals, ordersByDay, scoreManagers } from "../lib/metrics";
import Hero from "../components/Hero";
import NetworkMap from "../components/NetworkMap";
import ManagerBoard from "../components/ManagerBoard";
import { AreaChart, BarList } from "../components/charts";
import { ActivityList, AttentionList, Kpi, LoadFail, WarehouseTile, greeting } from "../components/blocks";
import { Chapter, Reveal, Skeleton, prefersReducedMotion } from "../components/ui";
import { ROLE_META } from "../lib/roles";

type Props = { user: any; go: (p: string, ctx?: any) => void };

export default function OwnerDashboard({ user, go }: Props) {
  const { data: s, error } = useLoad(loadSnapshot, [], 30000);
  const scores = useMemo(() => (s ? scoreManagers(s) : []), [s]);
  const totals = useMemo(() => (s ? networkTotals(s) : null), [s]);
  const days = useMemo(() => (s ? ordersByDay(s.orders, 7) : []), [s]);
  const attention = useMemo(() => (s ? attentionItems(s) : []), [s]);
  const avgScore = scores.length ? Math.round(scores.reduce((a, m) => a + m.score, 0) / scores.length) : 0;
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  const first = String(user.name || "").split(" ")[0] || "there";

  const lead = s && totals
    ? `${greeting()}, ${first}. ${s.warehouses.length} warehouses hold ${totals.units.toLocaleString("en-IN")} units, ${compactInr(totals.value)} of orders are on the books, and ${attention.length ? `${attention.length} thing${attention.length > 1 ? "s" : ""} need your eyes` : "nothing needs your attention"}.`
    : "Loading your network…";

  return (
    <>
      <Hero
        kicker="Owner · company command"
        title="Company" script="command"
        lead={lead}
        variant="network" accent={ROLE_META.owner.accent}
        belt={["Network live", "Every manager scored", "Every unit accountable", "One source of truth"]}
        chips={totals ? [{ label: "Network stock", value: totals.units.toLocaleString("en-IN") }, { label: "Open transfers", value: String(totals.open) }, { label: "Avg manager score", value: String(avgScore) }] : []}
        actions={<><button className="btn primary big" onClick={() => jump("managers")}>See manager scorecards</button><button className="btn big" onClick={() => go("transfers")}>Review transfers</button></>}
      />
      <LoadFail error={error} />

      <Chapter n="01" id="network" kicker="Chapter one" title="The network," em="right now" lead="Every warehouse, how much it holds, how full it is, and what is moving between them. Click a node to open its stock." tone="ink">
        {!s || !totals ? <Skeleton rows={4} /> : (
          <>
            <div className="kpis">
              <Kpi hot label="Units on hand" value={totals.units} sub="across every warehouse" />
              <Kpi label="Order value" value={totals.value} format={compactInr} sub={`${totals.orders} live orders`} delay={60} />
              <Kpi label="Fulfilment rate" value={Math.round((totals.fulfilRate ?? 0) * 100)} format={(n) => `${Math.round(n)}%`} sub="completed ÷ live orders" delay={120} />
              <Kpi label="Capacity used" value={Math.round((totals.utilization ?? 0) * 100)} format={(n) => `${Math.round(n)}%`} sub="network-wide" delay={180} />
              <Kpi label="Transfers in flight" value={totals.open} sub="awaiting a manager" delay={240} />
              <Kpi label="Low-stock lines" value={totals.low} sub="at or below reorder level" tone={totals.low > 4 ? "bad" : totals.low ? "warn" : undefined} delay={300} />
            </div>
            <Reveal className="card map-card">
              <NetworkMap warehouses={s.warehouses} inventory={s.inventory} transfers={s.transfers} onSelect={(w) => go("inventory", { warehouse: w.name })} />
            </Reveal>
            <div className="wtiles">
              {s.warehouses.map((w, i) => (
                <Reveal key={w.id} delay={i * 60}>
                  <WarehouseTile w={w} units={s.inventory.filter((x) => x.warehouse_id === w.id).reduce((a, x) => a + Number(x.quantity || 0), 0)} low={s.inventory.filter((x) => x.warehouse_id === w.id && x.low_stock).length} open={s.transfers.filter((t) => ["PENDING_DESTINATION_APPROVAL", "PENDING_SOURCE_DISPATCH", "IN_TRANSIT", "PENDING"].includes(String(t.status).toUpperCase()) && (t.source_warehouse_id === w.id || t.destination_warehouse_id === w.id)).length} onClick={() => go("inventory", { warehouse: w.name })} />
                </Reveal>
              ))}
            </div>
          </>
        )}
      </Chapter>

      <Chapter n="02" id="managers" kicker="Chapter two" title="Who is running" em="what" lead="Every warehouse manager, scored from real orders, stock and transfer timestamps, never opinions. Open a card to see exactly why." tone="accent"
        actions={<button className="btn ink" onClick={() => go("managers")}>Full scorecards</button>}>
        {!s ? <Skeleton rows={5} /> : <ManagerBoard scores={scores} go={go} compact />}
      </Chapter>

      <Chapter n="03" id="money" kicker="Chapter three" title="Money &" em="movement" lead="What customers ordered this week, and which warehouses carried the revenue." tone="surface">
        {!s || !totals ? <Skeleton rows={4} /> : (
          <div className="grid g2">
            <Reveal className="card">
              <h3>Order value, last 7 days</h3>
              <AreaChart label="Order value over the last seven days" data={days.map((d) => ({ label: d.label, value: d.value }))} format={compactInr} />
            </Reveal>
            <Reveal className="card" delay={80}>
              <h3>Revenue by warehouse</h3>
              <BarList format={compactInr} items={scores.map((m) => ({ label: m.warehouse.name, sub: `${m.orders} orders · ${m.manager}`, value: m.revenue })).sort((a, b) => b.value - a.value)} />
            </Reveal>
          </div>
        )}
      </Chapter>

      <Chapter n="04" id="attention" kicker="Chapter four" title="Needs your" em="attention" lead="The shortest path from “something is wrong” to “I know where”. Worst first." tone="ink">
        {!s ? <Skeleton rows={4} /> : <AttentionList items={attention} go={go} />}
      </Chapter>

      <Chapter n="05" id="audit" kicker="Chapter five" title="The audit" em="trail" lead="Every unit that moved, who it moved for, and where. Nothing changes stock without leaving a row here." tone="surface">
        {!s ? <Skeleton rows={5} /> : <Reveal className="card"><ActivityList transactions={s.transactions} products={s.products} warehouses={s.warehouses} limit={10} /></Reveal>}
      </Chapter>
    </>
  );
}
