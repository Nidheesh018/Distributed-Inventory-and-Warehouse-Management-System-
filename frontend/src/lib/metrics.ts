/* ------------------------------------------------------------------ *
 * Metrics + manager performance engine.
 * Pure functions over the API snapshot, so it works identically for the
 * live backend and the offline demo. Every number the owner sees on a
 * scorecard can be traced back to rows in these arrays.
 * ------------------------------------------------------------------ */

export const norm = (s: any) => String(s ?? "").toLowerCase();
export const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
export const compactInr = (n: number) => {
  const v = Math.abs(n || 0);
  if (v >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  if (v >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${Math.round(n || 0)}`;
};
export const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
export const initials = (name: string) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

export const isDone = (status: any) => ["completed", "fulfilled"].includes(norm(status));
export const isCancelled = (status: any) => ["cancelled", "canceled"].includes(norm(status));
export const OPEN_TRANSFER = ["PENDING", "PENDING_DESTINATION_APPROVAL", "PENDING_SOURCE_DISPATCH", "IN_TRANSIT"];
export const isOpenTransfer = (t: any) => OPEN_TRANSFER.includes(String(t.status).toUpperCase());

export function hoursBetween(a?: string | null, b?: string | number | null) {
  if (!a || b == null) return null;
  const d = (new Date(b as any).getTime() - new Date(a).getTime()) / 36e5;
  return Number.isFinite(d) && d >= 0 ? d : null;
}
export function ago(iso?: string | null, now = Date.now()) {
  if (!iso) return "—";
  const h = (now - new Date(iso).getTime()) / 36e5;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 48) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
export function dur(h: number | null) {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

export const OVERDUE_HOURS = 24;

/* ---------------- manager scorecards ---------------- */
export type Part = { key: string; label: string; weight: number; score: number | null; detail: string };
export type Tone = "great" | "good" | "warn" | "bad";
export type ManagerScore = {
  warehouse: any; manager: string; initials: string;
  orders: number; fulfilled: number; cancelled: number; stuck: number; revenue: number;
  units: number; lines: number; lowLines: number;
  utilization: number | null;
  actions: number; avgResponseH: number | null; overdue: number; openTransfers: number;
  parts: Part[]; score: number; grade: string; tone: Tone; insights: string[]; rank: number;
};

export const WEIGHTS = { fulfilment: 0.35, stock: 0.25, response: 0.25, utilization: 0.15 };
export const toneFor = (score: number): Tone => (score >= 85 ? "great" : score >= 70 ? "good" : score >= 55 ? "warn" : "bad");
export const gradeFor = (score: number) => (score >= 85 ? "Excellent" : score >= 70 ? "Solid" : score >= 55 ? "Needs focus" : "At risk");

type Input = { warehouses: any[]; inventory: any[]; orders: any[]; transfers: any[]; now?: number };

export function scoreManagers({ warehouses, inventory, orders, transfers, now = Date.now() }: Input): ManagerScore[] {
  const rows = warehouses.map((w) => {
    const inv = inventory.filter((x) => x.warehouse_id === w.id);
    const units = inv.reduce((s, x) => s + Number(x.quantity || 0), 0);
    const lowLines = inv.filter((x) => x.low_stock).length;

    const wo = orders.filter((o) => o.selected_warehouse_id === w.id && !isCancelled(o.status));
    const cancelled = orders.filter((o) => o.selected_warehouse_id === w.id && isCancelled(o.status)).length;
    const fulfilled = wo.filter((o) => isDone(o.status)).length;
    const stuck = wo.filter((o) => !isDone(o.status) && (hoursBetween(o.created_at, now) ?? 0) > 48).length;
    const revenue = wo.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const fulfilRate = wo.length ? fulfilled / wo.length : null;
    const stockHealth = inv.length ? 1 - lowLines / inv.length : null;

    // transfer responsiveness: the time this manager took to act when the ball was in their court
    const times: number[] = [];
    let overdue = 0;
    let open = 0;
    transfers.forEach((t) => {
      const st = String(t.status).toUpperCase();
      const asDest = t.destination_warehouse_id === w.id;
      const asSrc = t.source_warehouse_id === w.id;
      if (!asDest && !asSrc) return;
      if (isOpenTransfer(t)) open++;
      if (asDest) {
        const decided = t.destination_approved_at || t.rejected_at;
        if (decided) { const h = hoursBetween(t.created_at, decided); if (h != null) times.push(h); }
        else if (st === "PENDING_DESTINATION_APPROVAL") { const h = hoursBetween(t.created_at, now) ?? 0; times.push(h); if (h > OVERDUE_HOURS) overdue++; }
        if (t.received_at) { const h = hoursBetween(t.source_dispatched_at, t.received_at); if (h != null) times.push(h); }
        else if (st === "IN_TRANSIT") { const h = hoursBetween(t.source_dispatched_at, now) ?? 0; if (h > OVERDUE_HOURS) { overdue++; times.push(h); } }
      }
      if (asSrc) {
        if (t.source_dispatched_at) { const h = hoursBetween(t.destination_approved_at, t.source_dispatched_at); if (h != null) times.push(h); }
        else if (st === "PENDING_SOURCE_DISPATCH") { const h = hoursBetween(t.destination_approved_at, now) ?? 0; times.push(h); if (h > OVERDUE_HOURS) overdue++; }
      }
    });
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
    const response = avg == null ? null : clamp((avg <= 4 ? 1 : 1 - (avg - 4) / 44) - overdue * 0.08);

    const util = w.capacity && w.current_load ? Number(w.current_load) / Number(w.capacity) : null;
    const utilScore = util == null ? null : util < 0.45 ? clamp(util / 0.45) : util > 0.85 ? clamp(1 - (util - 0.85) / 0.15) : 1;

    const parts: Part[] = [
      { key: "fulfilment", label: "Order fulfilment", weight: WEIGHTS.fulfilment, score: fulfilRate, detail: wo.length ? `${fulfilled} of ${wo.length} orders completed${stuck ? ` · ${stuck} stuck >48h` : ""}` : "No orders routed here yet" },
      { key: "stock", label: "Stock health", weight: WEIGHTS.stock, score: stockHealth, detail: inv.length ? `${inv.length - lowLines} of ${inv.length} product lines above reorder level` : "No inventory lines" },
      { key: "response", label: "Transfer response time", weight: WEIGHTS.response, score: response, detail: avg == null ? "No transfer actions yet" : `Avg ${dur(avg)} to act${overdue ? ` · ${overdue} overdue` : ""}` },
      { key: "utilization", label: "Capacity balance", weight: WEIGHTS.utilization, score: utilScore, detail: util == null ? "Capacity not reported" : `${Math.round(util * 100)}% full · target 45–85%` },
    ];
    const live = parts.filter((p) => p.score != null);
    const totalW = live.reduce((s, p) => s + p.weight, 0);
    const score = totalW ? Math.round((live.reduce((s, p) => s + (p.score as number) * p.weight, 0) / totalW) * 100) : 0;

    const insights: string[] = [];
    if (overdue) insights.push(`${overdue} transfer${overdue > 1 ? "s" : ""} waiting more than ${OVERDUE_HOURS}h on this manager`);
    if (stuck) insights.push(`${stuck} order${stuck > 1 ? "s" : ""} allocated but not completed after 48h`);
    if (lowLines) insights.push(`${lowLines} product line${lowLines > 1 ? "s" : ""} at or below reorder level`);
    if (util != null && util > 0.85) insights.push(`Warehouse is ${Math.round(util * 100)}% full: little room for inbound stock`);
    if (util != null && util < 0.45) insights.push(`Only ${Math.round(util * 100)}% of capacity used: consider consolidating`);
    if (avg != null && avg <= 4) insights.push(`Fast responder: acts on transfers in ${dur(avg)} on average`);
    if (fulfilRate != null && fulfilRate >= 0.9) insights.push(`${Math.round(fulfilRate * 100)}% order fulfilment`);
    if (!insights.length) insights.push("No issues flagged");

    const manager = w.manager_name || w.manager || "Unassigned manager";
    return { warehouse: w, manager, initials: initials(manager), orders: wo.length, fulfilled, cancelled, stuck, revenue, units, lines: inv.length, lowLines, utilization: util, actions: times.length, avgResponseH: avg, overdue, openTransfers: open, parts, score, grade: gradeFor(score), tone: toneFor(score), insights, rank: 0 } as ManagerScore;
  });
  [...rows].sort((a, b) => b.score - a.score).forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

/* ---------------- network helpers ---------------- */
export function networkTotals(s: { inventory: any[]; orders: any[]; warehouses: any[]; transfers: any[] }) {
  const units = s.inventory.reduce((a, x) => a + Number(x.quantity || 0), 0);
  const live = s.orders.filter((o) => !isCancelled(o.status));
  const value = live.reduce((a, o) => a + Number(o.total_amount || 0), 0);
  const low = s.inventory.filter((x) => x.low_stock).length;
  const open = s.transfers.filter(isOpenTransfer).length;
  const cap = s.warehouses.reduce((a, w) => a + Number(w.capacity || 0), 0);
  const load = s.warehouses.reduce((a, w) => a + Number(w.current_load || 0), 0);
  const done = live.filter((o) => isDone(o.status)).length;
  return { units, value, orders: live.length, low, open, utilization: cap && load ? load / cap : null, fulfilRate: live.length ? done / live.length : null };
}

export function ordersByDay(orders: any[], days = 7, now = Date.now()) {
  const out: { label: string; orders: number; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 864e5);
    const key = d.toDateString();
    const list = orders.filter((o) => !isCancelled(o.status) && new Date(o.created_at).toDateString() === key);
    out.push({ label: d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit" }), orders: list.length, value: list.reduce((s, o) => s + Number(o.total_amount || 0), 0) });
  }
  return out;
}

export type Attention = { id: string; tone: "bad" | "warn" | "info"; title: string; detail: string; go: string; ctx?: any };
export function attentionItems(s: { inventory: any[]; orders: any[]; warehouses: any[]; transfers: any[] }, now = Date.now()): Attention[] {
  const wh = (id: number) => s.warehouses.find((w) => w.id === id)?.name ?? `Warehouse #${id}`;
  const items: Attention[] = [];
  s.transfers.forEach((t) => {
    const st = String(t.status).toUpperCase();
    const since = st === "PENDING_DESTINATION_APPROVAL" ? t.created_at : st === "PENDING_SOURCE_DISPATCH" ? t.destination_approved_at : st === "IN_TRANSIT" ? t.source_dispatched_at : null;
    const h = since ? hoursBetween(since, now) : null;
    if (h != null && h > OVERDUE_HOURS) {
      const who = st === "PENDING_SOURCE_DISPATCH" ? wh(t.source_warehouse_id) : wh(t.destination_warehouse_id);
      const need = st === "PENDING_DESTINATION_APPROVAL" ? "approval" : st === "PENDING_SOURCE_DISPATCH" ? "dispatch" : "receipt";
      items.push({ id: `t${t.id}`, tone: "bad", title: `Transfer #${t.id} waiting ${dur(h)} for ${need}`, detail: `${t.product ?? "Stock"} · ${wh(t.source_warehouse_id)} → ${wh(t.destination_warehouse_id)} · ${who} must act`, go: "transfers" });
    }
  });
  s.inventory.filter((x) => x.low_stock).sort((a, b) => Number(a.available_quantity) / Math.max(1, Number(a.reorder_level || 10)) - Number(b.available_quantity) / Math.max(1, Number(b.reorder_level || 10))).slice(0, 5).forEach((x) =>
    items.push({ id: `i${x.inventory_id}`, tone: Number(x.available_quantity) <= 3 ? "bad" : "warn", title: `${x.product}: only ${x.available_quantity} available`, detail: `${x.warehouse} · ${x.sku}`, go: "inventory", ctx: { query: x.sku } }));
  const stuck = s.orders.filter((o) => !isDone(o.status) && !isCancelled(o.status) && (hoursBetween(o.created_at, now) ?? 0) > 48);
  if (stuck.length) items.push({ id: "stuck", tone: "warn", title: `${stuck.length} order${stuck.length > 1 ? "s" : ""} allocated but not completed after 48h`, detail: "Check the fulfilling warehouses", go: "orders" });
  return items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "bad" ? -1 : b.tone === "bad" ? 1 : 0));
}

/* what a given staff member must do on a transfer right now */
export function transferNeeds(t: any, role: string, warehouseId?: number | null) {
  const st = String(t.status).toUpperCase();
  const elevated = role === "owner" || role === "admin";
  const mgr = role === "warehouse_manager";
  const dest = Number(t.destination_warehouse_id) === Number(warehouseId);
  const src = Number(t.source_warehouse_id) === Number(warehouseId);
  return {
    approve: st === "PENDING_DESTINATION_APPROVAL" && (elevated || (mgr && dest)),
    dispatch: st === "PENDING_SOURCE_DISPATCH" && (elevated || (mgr && src)),
    receive: st === "IN_TRANSIT" && (elevated || (mgr && dest)),
  };
}
export const needsMyAction = (t: any, role: string, warehouseId?: number | null) => {
  const n = transferNeeds(t, role, warehouseId);
  return n.approve || n.dispatch || n.receive;
};
