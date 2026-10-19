import { useMemo, useState } from "react";
import { getOrders, loadSnapshot } from "../services/api";
import { useLoad } from "../lib/hooks";
import { ago, compactInr, inr, isCancelled, isDone } from "../lib/metrics";
import { Badge, BadgeTone, Chips, Empty, PageHead, Skeleton } from "../components/ui";
import { Kpi, LoadFail } from "../components/blocks";

const kind = (o: any) => (isCancelled(o.status) ? "cancelled" : isDone(o.status) ? "done" : "open");
const LABEL: Record<string, [string, BadgeTone]> = { open: ["In progress", "warn"], done: ["Completed", "good"], cancelled: ["Cancelled", "plain"] };

export default function OrdersPage({ role }: { role: string }) {
  const isCustomer = role === "customer";
  const { data, error } = useLoad(async () => (isCustomer ? { orders: await getOrders(), warehouses: [] as any[] } : loadSnapshot()), [role], 20000);
  const [status, setStatus] = useState<"all" | "open" | "done" | "cancelled">("all");
  const [wh, setWh] = useState("all");
  const orders = data?.orders ?? [];
  const warehouses = data?.warehouses ?? [];
  const name = (id: number) => warehouses.find((w: any) => w.id === id)?.name ?? (id ? `Warehouse #${id}` : "—");
  const rows = useMemo(() => orders.filter((o: any) => (status === "all" || kind(o) === status) && (wh === "all" || String(o.selected_warehouse_id) === wh)), [orders, status, wh]);
  const live = orders.filter((o: any) => !isCancelled(o.status));
  const count = (k: string) => orders.filter((o: any) => kind(o) === k).length;

  return (
    <div className="wrap page">
      <PageHead kicker={isCustomer ? "Your history" : "Order control"} title={isCustomer ? "My" : "Order"} em={isCustomer ? "orders" : "control"} lead={isCustomer ? "Every order you've placed with the network." : role === "warehouse_manager" ? "Orders the allocator routed to your warehouse." : "Every order and the warehouse the allocator chose to fulfil it."} />
      <LoadFail error={error} />
      {!data ? <Skeleton rows={6} /> : (
        <>
          <div className="kpis three">
            <Kpi hot label="Orders" value={live.length} sub={`${count("cancelled")} cancelled`} />
            <Kpi label="Order value" value={live.reduce((a: number, o: any) => a + Number(o.total_amount || 0), 0)} format={compactInr} delay={60} />
            <Kpi label="Completed" value={count("done")} sub={`${count("open")} in progress`} delay={120} />
          </div>
          <div className="toolbar">
            <Chips label="Order status" value={status} onChange={setStatus} options={[{ v: "all", label: "All", count: orders.length }, { v: "open", label: "In progress", count: count("open") }, { v: "done", label: "Completed", count: count("done") }, { v: "cancelled", label: "Cancelled", count: count("cancelled") }]} />
          </div>
          {!isCustomer && role !== "warehouse_manager" && warehouses.length > 1 && <Chips label="Warehouse" value={wh} onChange={setWh} options={[{ v: "all", label: "All warehouses" }, ...warehouses.map((w: any) => ({ v: String(w.id), label: w.city || w.name }))]} />}
          {rows.length === 0 ? <Empty title="No orders here" body={isCustomer ? "Place your first order from the shop." : "No orders match these filters."} /> : (
            <div className="card tablecard">
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Order</th>{!isCustomer && <th>Customer</th>}<th>Status</th>{!isCustomer && <th>Fulfilled by</th>}<th className="num">Total</th><th>Placed</th></tr></thead>
                  <tbody>
                    {rows.map((o: any) => { const [label, tone] = LABEL[kind(o)]; return (
                      <tr key={o.id}>
                        <td><strong>#{o.id}</strong></td>
                        {!isCustomer && <td>{o.customer_name || `Customer #${o.customer_id}`}</td>}
                        <td><Badge tone={tone}>{label}</Badge></td>
                        {!isCustomer && <td>{name(o.selected_warehouse_id)}</td>}
                        <td className="num">{inr(Number(o.total_amount))}</td>
                        <td><span title={new Date(o.created_at).toLocaleString()}>{ago(o.created_at)}</span></td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
