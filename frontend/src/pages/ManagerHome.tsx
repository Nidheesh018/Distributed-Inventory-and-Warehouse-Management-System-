import { useCallback, useMemo } from "react";
import { loadSnapshot } from "../services/api";
import { useLoad } from "../lib/hooks";
import { needsMyAction, scoreManagers } from "../lib/metrics";
import Hero from "../components/Hero";
import TransferCard, { useTransferActions } from "../components/transfer";
import { ActivityList, Kpi, LoadFail, greeting } from "../components/blocks";
import { Badge, Chapter, Empty, Meter, Notice, Reveal, Ring, Skeleton, prefersReducedMotion } from "../components/ui";
import { ROLE_META } from "../lib/roles";

type Props = { user: any; go: (p: string, ctx?: any) => void };

export default function ManagerHome({ user, go }: Props) {
  const { data: s, error, reload } = useLoad(loadSnapshot, [], 20000);
  const actions = useTransferActions(reload);
  const wid = user.warehouse_id;
  const w = s?.warehouses.find((x) => x.id === wid) ?? null;
  const me = useMemo(() => (s && w ? scoreManagers({ ...s, warehouses: [w] })[0] : null), [s, w]);
  const queue = useMemo(() => (s ? s.transfers.filter((t) => needsMyAction(t, "warehouse_manager", wid)) : []), [s, wid]);
  const myStock = useMemo(() => (s ? s.inventory.filter((x) => x.warehouse_id === wid).sort((a, b) => Number(a.available_quantity) / Math.max(1, Number(a.reorder_level || 10)) - Number(b.available_quantity) / Math.max(1, Number(b.reorder_level || 10))) : []), [s, wid]);
  const jump = useCallback((id: string) => document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" }), []);
  const first = String(user.name || "").split(" ")[0] || "there";
  const util = w && w.capacity && w.current_load ? Math.round((Number(w.current_load) / Number(w.capacity)) * 100) : null;
  const low = myStock.filter((x) => x.low_stock).length;
  const units = myStock.reduce((a, x) => a + Number(x.quantity || 0), 0);
  const weakest = me ? [...me.parts].filter((p) => p.score != null).sort((a, b) => (a.score as number) - (b.score as number))[0] : null;

  return (
    <>
      <Hero
        kicker={`Warehouse manager · ${w?.code ?? "—"}`}
        title={w?.city || String(w?.name || "Your").split(" ")[0]} script="warehouse"
        lead={s && me ? `${greeting()}, ${first}. ${queue.length ? `${queue.length} transfer${queue.length > 1 ? "s are" : " is"} waiting on you` : "Your queue is clear"}, ${low ? `${low} product line${low > 1 ? "s are" : " is"} low` : "stock is healthy"}, and your scorecard sits at ${me.score}/100.` : "Loading your warehouse…"}
        variant="warehouse" accent={ROLE_META.warehouse_manager.accent}
        belt={["Your floor", "Your queue", "Your score", "Your stock"]}
        chips={s && me ? [{ label: "Units on hand", value: units.toLocaleString("en-IN") }, { label: "Waiting on you", value: String(queue.length) }, { label: "Your score", value: String(me.score) }] : []}
        actions={<><button className="btn primary big" onClick={() => jump("queue")}>Open my queue{queue.length ? ` (${queue.length})` : ""}</button><button className="btn big" onClick={() => go("inventory")}>Inventory & transfers</button></>}
      />
      <LoadFail error={error} />

      <Chapter n="01" id="queue" kicker="Chapter one" title="Your" em="queue" lead="Transfers that are waiting on you right now. Approve, dispatch or receive them here; you do not need to open another page." tone="ink">
        {actions.message && <Notice onClose={actions.clear}>{actions.message}</Notice>}
        {actions.error && <Notice kind="err" onClose={actions.clear}>{actions.error}</Notice>}
        {!s ? <Skeleton rows={4} /> : queue.length === 0 ? (
          <Empty title="Queue clear" body="Nothing is waiting on you. Nice. New requests appear here the moment they are raised.">
            <button className="btn" onClick={() => go("transfers")}>See all transfers</button>
          </Empty>
        ) : (
          <div className="tlist">{queue.map((t) => <Reveal key={t.id}><TransferCard t={t} role="warehouse_manager" warehouseId={wid} busy={actions.busy} onAct={actions.act} /></Reveal>)}</div>
        )}
      </Chapter>

      <Chapter n="02" id="score" kicker="Chapter two" title="Your" em="scorecard" lead="How the owner sees your warehouse. Same rules for every manager, rebuilt from live data." tone="accent">
        {!me ? <Skeleton rows={4} /> : (
          <div className="score-grid">
            <Reveal className="card score-hero">
              <Ring value={me.score} size={168} sub="out of 100" label="Your score" />
              <Badge tone={me.tone === "bad" ? "bad" : me.tone === "warn" ? "warn" : "good"}>{me.grade}</Badge>
              {weakest && <p className="muted">Biggest lever: <strong>{weakest.label.toLowerCase()}</strong>. {weakest.detail}.</p>}
            </Reveal>
            <Reveal className="card" delay={80}>
              <div className="mgr-parts single">
                {me.parts.map((p) => (
                  <div className="part" key={p.key}>
                    <div className="part-top"><strong>{p.label}</strong><span className="weight">{Math.round(p.weight * 100)}% of score</span><b>{p.score == null ? "n/a" : Math.round(p.score * 100)}</b></div>
                    <Meter value={(p.score ?? 0) * 100} tone={p.score == null ? "accent" : p.score >= 0.85 ? "good" : p.score >= 0.6 ? "warn" : "bad"} label={p.label} />
                    <small>{p.detail}</small>
                  </div>
                ))}
              </div>
              <h4>What the data says</h4>
              <ul className="insights">{me.insights.map((i) => <li key={i}>{i}</li>)}</ul>
            </Reveal>
          </div>
        )}
      </Chapter>

      <Chapter n="03" id="floor" kicker="Chapter three" title="Your" em="floor" lead="Lowest-cover products first, so the thing most likely to run out is always at the top." tone="surface"
        actions={<button className="btn" onClick={() => go("inventory")}>Open full inventory</button>}>
        {!s || !w ? <Skeleton rows={5} /> : (
          <>
            <div className="kpis three">
              <Kpi hot label="Units on hand" value={units} sub={`${myStock.length} product lines`} />
              <Kpi label="Capacity used" value={util ?? 0} format={(n) => `${Math.round(n)}%`} sub={w.capacity ? `of ${Number(w.capacity).toLocaleString("en-IN")} units` : undefined} delay={60} />
              <Kpi label="Low-stock lines" value={low} sub="at or below reorder level" tone={low > 2 ? "bad" : low ? "warn" : undefined} delay={120} />
            </div>
            <Reveal className="card">
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Product</th><th>Available</th><th>Cover vs reorder level</th><th>Status</th></tr></thead>
                  <tbody>
                    {myStock.slice(0, 8).map((x) => {
                      const ratio = Math.min(100, (Number(x.available_quantity) / Math.max(1, Number(x.reorder_level || 10) * 2)) * 100);
                      return (
                        <tr key={x.inventory_id}>
                          <td><strong>{x.product}</strong><br /><small className="muted">{x.sku}</small></td>
                          <td>{x.available_quantity}<small className="muted"> of {x.quantity}</small></td>
                          <td className="cell-meter"><Meter value={ratio} tone={x.low_stock ? "bad" : "good"} label={`${x.product} cover`} /></td>
                          <td><Badge tone={x.low_stock ? "bad" : "good"}>{x.low_stock ? "Low" : "Healthy"}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </>
        )}
      </Chapter>

      <Chapter n="04" id="moves" kicker="Chapter four" title="What just" em="moved" lead="The last stock movements in your warehouse: orders shipped, transfers in and out." tone="ink">
        {!s ? <Skeleton rows={5} /> : <Reveal className="card"><ActivityList transactions={s.transactions} products={s.products} warehouses={s.warehouses} limit={8} showWarehouse={false} /></Reveal>}
      </Chapter>
    </>
  );
}
