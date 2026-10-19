import { FormEvent, useEffect, useMemo, useState } from "react";
import { createProduct, loadSnapshot, transferStock } from "../services/api";
import { useLoad } from "../lib/hooks";
import { ago } from "../lib/metrics";
import { ActivityList } from "../components/blocks";
import { Badge, Chips, Empty, Icon, Meter, Notice, PageHead, Skeleton } from "../components/ui";

type Ctx = { warehouse?: string; query?: string } | undefined;
const EMPTY_TRANSFER = { productId: "", source: "", destination: "", quantity: "1", reason: "" };

export default function InventoryPage({ role, warehouseId, ctx }: { role: string; warehouseId?: number | null; ctx?: Ctx }) {
  const { data: s, error, reload } = useLoad(loadSnapshot, [], 10000);
  const isMgr = role === "warehouse_manager";
  const [query, setQuery] = useState(ctx?.query || "");
  const [wh, setWh] = useState<string>(ctx?.warehouse || "all");
  const [status, setStatus] = useState<"all" | "low" | "ok">("all");
  const [panel, setPanel] = useState<"" | "transfer" | "product">("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fail, setFail] = useState("");
  const [transfer, setTransfer] = useState({ ...EMPTY_TRANSFER, source: isMgr && warehouseId ? String(warehouseId) : "" });
  const [product, setProduct] = useState({ sku: "", name: "", category: "", price: "", reorder_level: "5", stock: {} as Record<number, string> });

  useEffect(() => { if (ctx?.warehouse) setWh(ctx.warehouse); if (ctx?.query) setQuery(ctx.query); }, [ctx]);

  const rows = useMemo(() => {
    if (!s) return [];
    const q = query.trim().toLowerCase();
    return s.inventory
      .filter((r) => (wh === "all" || r.warehouse === wh) && (status === "all" || (status === "low" ? r.low_stock : !r.low_stock)) && (!q || `${r.product} ${r.sku} ${r.warehouse}`.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.low_stock) - Number(a.low_stock) || String(a.product).localeCompare(String(b.product)));
  }, [s, query, wh, status]);

  const myWarehouses = s ? s.warehouses.filter((w) => !isMgr || w.id === warehouseId) : [];
  const availAtSource = s && transfer.productId && transfer.source ? s.inventory.find((x) => x.product_id === Number(transfer.productId) && x.warehouse_id === Number(transfer.source))?.available_quantity : undefined;
  const lowCount = s ? s.inventory.filter((r) => (wh === "all" || r.warehouse === wh) && r.low_stock).length : 0;

  async function submitTransfer(e: FormEvent) {
    e.preventDefault(); setMessage(""); setFail("");
    const qty = Number(transfer.quantity);
    if (availAtSource != null && qty > Number(availAtSource)) { setFail(`Only ${availAtSource} units are available at the source warehouse.`); return; }
    setBusy(true);
    try {
      const r = await transferStock(Number(transfer.productId), Number(transfer.source), Number(transfer.destination), qty, transfer.reason || "Stock balancing");
      setMessage(`Transfer #${r.id} created. The units are reserved and waiting for the destination manager to approve.`);
      setTransfer({ ...EMPTY_TRANSFER, source: transfer.source }); await reload();
    } catch (err: any) { setFail(err.message); } finally { setBusy(false); }
  }
  async function submitProduct(e: FormEvent) {
    e.preventDefault(); setMessage(""); setFail(""); setBusy(true);
    try {
      const initial = Object.fromEntries(myWarehouses.map((w) => [w.id, Number(product.stock[w.id] || 0)]));
      const r = await createProduct({ sku: product.sku, name: product.name, category: product.category, price: Number(product.price), reorder_level: Number(product.reorder_level), initial_stock: initial });
      setMessage(`${r.name} (${r.sku}) added${isMgr ? " to your warehouse" : " and stocked across the network"}.`);
      setProduct({ sku: "", name: "", category: "", price: "", reorder_level: "5", stock: {} }); await reload();
    } catch (err: any) { setFail(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="wrap page">
      <PageHead kicker="Live inventory · refreshes every 10s" title="Inventory" em="matrix" lead={isMgr ? "Your warehouse's stock. Low-cover products float to the top." : "Every product in every warehouse. Low-cover products float to the top."}>
        <button className={`btn${panel === "transfer" ? " primary" : ""}`} aria-expanded={panel === "transfer"} onClick={() => setPanel(panel === "transfer" ? "" : "transfer")}><Icon name="swap" size={16} /> Transfer stock</button>
        <button className={`btn${panel === "product" ? " primary" : ""}`} aria-expanded={panel === "product"} onClick={() => setPanel(panel === "product" ? "" : "product")}><Icon name="plus" size={16} /> Add product</button>
      </PageHead>

      {message && <Notice onClose={() => setMessage("")}>{message}</Notice>}
      {(fail || error) && <Notice kind="err" onClose={() => setFail("")}>{fail || error}</Notice>}

      {panel === "transfer" && (
        <form className="card formcard" onSubmit={submitTransfer}>
          <h3>Request a stock transfer</h3>
          <p className="muted">Stock is reserved at the source immediately. It moves only after the destination manager approves, the source dispatches and the destination confirms receipt.</p>
          <div className="formgrid">
            <label>Product<select required value={transfer.productId} onChange={(e) => setTransfer({ ...transfer, productId: e.target.value })}><option value="">Select product</option>{s?.products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></label>
            <label>From<select required value={transfer.source} onChange={(e) => setTransfer({ ...transfer, source: e.target.value })}><option value="">Source warehouse</option>{myWarehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
            <label>To<select required value={transfer.destination} onChange={(e) => setTransfer({ ...transfer, destination: e.target.value })}><option value="">Destination warehouse</option>{s?.warehouses.filter((w) => String(w.id) !== transfer.source).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
            <label>Quantity<input type="number" min="1" required value={transfer.quantity} onChange={(e) => setTransfer({ ...transfer, quantity: e.target.value })} />{availAtSource != null && <small className="hint">{availAtSource} available at source</small>}</label>
            <label className="wide">Reason<input placeholder="e.g. Rebalance low stock" value={transfer.reason} onChange={(e) => setTransfer({ ...transfer, reason: e.target.value })} /></label>
          </div>
          <div className="formactions"><button className="btn primary" disabled={busy}>{busy ? "Submitting…" : "Submit request"}</button><button type="button" className="btn ghost" onClick={() => setPanel("")}>Cancel</button></div>
        </form>
      )}

      {panel === "product" && (
        <form className="card formcard" onSubmit={submitProduct}>
          <h3>Add a product</h3>
          <div className="formgrid">
            <label>SKU<input required value={product.sku} onChange={(e) => setProduct({ ...product, sku: e.target.value })} /></label>
            <label>Name<input required value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} /></label>
            <label>Category<input required value={product.category} onChange={(e) => setProduct({ ...product, category: e.target.value })} /></label>
            <label>Price (₹)<input type="number" min="0" step="0.01" required value={product.price} onChange={(e) => setProduct({ ...product, price: e.target.value })} /></label>
            <label>Reorder level<input type="number" min="0" required value={product.reorder_level} onChange={(e) => setProduct({ ...product, reorder_level: e.target.value })} /></label>
            {myWarehouses.map((w) => <label key={w.id}>{w.name} · initial stock<input type="number" min="0" value={product.stock[w.id] ?? "0"} onChange={(e) => setProduct({ ...product, stock: { ...product.stock, [w.id]: e.target.value } })} /></label>)}
          </div>
          <div className="formactions"><button className="btn primary" disabled={busy}>{busy ? "Adding…" : "Add product"}</button><button type="button" className="btn ghost" onClick={() => setPanel("")}>Cancel</button></div>
        </form>
      )}

      <div className="toolbar">
        <label className="search"><span className="sr">Search inventory</span><input type="search" placeholder="Search product, SKU or warehouse" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <Chips label="Stock status" value={status} onChange={setStatus} options={[{ v: "all", label: "All" }, { v: "low", label: "Low stock", count: lowCount }, { v: "ok", label: "Healthy" }]} />
      </div>
      {!isMgr && s && s.warehouses.length > 1 && (
        <Chips label="Warehouse" value={wh} onChange={setWh} options={[{ v: "all", label: "All warehouses" }, ...s.warehouses.map((w) => ({ v: w.name, label: w.city || w.name }))]} />
      )}

      {!s ? <Skeleton rows={6} /> : rows.length === 0 ? <Empty title="No stock matches" body="Try a different search or clear the filters."><button className="btn" onClick={() => { setQuery(""); setWh("all"); setStatus("all"); }}>Clear filters</button></Empty> : (
        <div className="card tablecard">
          <div className="tablewrap">
            <table>
              <thead><tr><th>Product</th><th>Warehouse</th><th className="num">On hand</th><th className="num">Reserved</th><th className="num">Available</th><th>Cover</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.inventory_id}>
                    <td><strong>{r.product}</strong><br /><small className="muted">{r.sku}</small></td>
                    <td>{r.warehouse}</td>
                    <td className="num">{r.quantity}</td><td className="num">{r.reserved_quantity}</td><td className="num"><strong>{r.available_quantity}</strong></td>
                    <td className="cell-meter"><Meter value={Math.min(100, (Number(r.available_quantity) / Math.max(1, Number(r.reorder_level || 10) * 2)) * 100)} tone={r.low_stock ? "bad" : "good"} label={`${r.product} cover`} /></td>
                    <td><Badge tone={r.low_stock ? "bad" : "good"}>{r.low_stock ? "Low stock" : "Healthy"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="muted count-note">{s ? `${rows.length} of ${s.inventory.length} stock lines` : ""}</p>

      {s && (
        <details className="card audit">
          <summary><strong>Recent inventory movements</strong><span className="muted">{s.transactions[0] ? `latest ${ago(s.transactions[0].created_at)}` : ""}</span></summary>
          <ActivityList transactions={s.transactions} products={s.products} warehouses={s.warehouses} limit={12} />
        </details>
      )}
    </div>
  );
}
