import { ReactNode } from "react";
import { Avatar, Badge, CountUp, Empty, Icon, Meter, Reveal } from "./ui";
import { Attention, ago } from "../lib/metrics";

export function Kpi({ label, value, sub, format, hot, delay = 0, tone }: { label: string; value: number; sub?: string; format?: (n: number) => string; hot?: boolean; delay?: number; tone?: "bad" | "warn" }) {
  return (
    <Reveal className={`kpi${hot ? " hot" : ""}${tone ? ` k-${tone}` : ""}`} delay={delay}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value"><CountUp value={value} format={format} /></strong>
      {sub && <small>{sub}</small>}
    </Reveal>
  );
}

export function WarehouseTile({ w, units, low, open, onClick, limited }: { w: any; units: number; low: number; open: number; onClick?: () => void; limited?: boolean }) {
  const util = w.capacity && w.current_load ? (Number(w.current_load) / Number(w.capacity)) * 100 : 0;
  const tone = util > 85 ? "bad" : util > 70 ? "warn" : "good";
  return (
    <button className="wtile" onClick={onClick} disabled={!onClick}>
      <span className="wtile-top"><small>{w.code}</small><Badge tone={String(w.status).toUpperCase() === "ONLINE" ? "good" : "warn"}>{w.status || "ONLINE"}</Badge></span>
      <strong>{w.name}</strong>
      <span className="wtile-mgr"><Avatar name={w.manager_name || "?"} size={26} />{w.manager_name || "No manager assigned"}</span>
      <Meter value={util} tone={tone} label={`${w.name} capacity used`} />
      {limited
        ? <span className="wtile-stats"><span><b>{Math.round(util)}%</b> full</span><span><b>{w.capacity ? Number(w.capacity).toLocaleString("en-IN") : "—"}</b> capacity</span><span><b>{w.city}</b></span></span>
        : <span className="wtile-stats"><span><b>{units.toLocaleString("en-IN")}</b> units</span><span><b>{low}</b> low</span><span><b>{open}</b> open</span><span><b>{Math.round(util)}%</b> full</span></span>}
    </button>
  );
}

export function AttentionList({ items, go, empty = "All clear. Nothing needs attention right now." }: { items: Attention[]; go: (page: string, ctx?: any) => void; empty?: string }) {
  if (!items.length) return <Empty title="All clear" body={empty} />;
  return (
    <ul className="attn">
      {items.slice(0, 8).map((a, i) => (
        <Reveal as="li" key={a.id} delay={i * 40} className={`attn-item a-${a.tone}`}>
          <span className="attn-dot" aria-hidden="true"><Icon name="alert" size={16} /></span>
          <span className="attn-text"><strong>{a.title}</strong><small>{a.detail}</small></span>
          <button className="btn small" onClick={() => go(a.go, a.ctx)}>Open</button>
        </Reveal>
      ))}
    </ul>
  );
}

const TYPE_LABEL: Record<string, string> = { ORDER_DEBIT: "Order shipped", TRANSFER_OUT: "Transfer out", TRANSFER_IN: "Transfer in", RESTOCK: "Restock", INITIAL_STOCK: "Initial stock", ADJUSTMENT: "Adjustment" };
export function ActivityList({ transactions, products, warehouses, limit = 8, showWarehouse = true }: { transactions: any[]; products: any[]; warehouses: any[]; limit?: number; showWarehouse?: boolean }) {
  if (!transactions.length) return <Empty title="No movements yet" body="Stock movements appear here the moment they happen." />;
  return (
    <ul className="activity">
      {transactions.slice(0, limit).map((t) => {
        const type = String(t.type || t.transaction_type || "").toUpperCase();
        const q = Number(t.quantity);
        return (
          <li key={t.id}>
            <span className={`act-q ${q < 0 ? "out" : "in"}`}>{q > 0 ? "+" : ""}{q}</span>
            <span className="act-text"><strong>{TYPE_LABEL[type] || type.replace(/_/g, " ").toLowerCase()}</strong><small>{products.find((p) => p.id === t.product_id)?.name ?? `Product #${t.product_id}`}{showWarehouse && <> · {warehouses.find((w) => w.id === t.warehouse_id)?.name ?? `Warehouse #${t.warehouse_id}`}</>} · ref #{t.reference_id}</small></span>
            <time dateTime={t.created_at}>{ago(t.created_at)}</time>
          </li>
        );
      })}
    </ul>
  );
}

export function LoadFail({ error, children }: { error: string; children?: ReactNode }) {
  return error ? <div className="notice n-err" role="alert"><span>{error}</span></div> : <>{children}</>;
}

export const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
