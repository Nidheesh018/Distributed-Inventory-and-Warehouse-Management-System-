import { useMemo, useState } from "react";
import { createOrder, getProducts } from "../services/api";
import { useLoad } from "../lib/hooks";
import { inr } from "../lib/metrics";
import Hero from "../components/Hero";
import { Chips, Icon, Notice, Skeleton } from "../components/ui";
import { LoadFail } from "../components/blocks";
import { ROLE_META } from "../lib/roles";

type Receipt = { id: number; product: string; qty: number; total: number; warehouse: string };

export default function CustomerPortal({ user, go }: { user: any; go: (p: string) => void }) {
  const { data: products, error } = useLoad(getProducts, []);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [cat, setCat] = useState("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [fail, setFail] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const cats = useMemo(() => Array.from(new Set((products ?? []).map((p: any) => p.category))).sort() as string[], [products]);
  const shown = useMemo(() => (products ?? []).filter((p: any) => (cat === "all" || p.category === cat) && (!query.trim() || `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(query.trim().toLowerCase()))), [products, cat, query]);

  async function buy(p: any) {
    const q = qty[p.id] ?? 1;
    setBusy(p.id); setFail(""); setReceipt(null);
    try {
      const r = await createOrder(user.customer_id, p.id, q);
      setReceipt({ id: r.id, product: p.name, qty: q, total: Number(p.price) * q, warehouse: r.selected_warehouse || `Warehouse #${r.selected_warehouse_id}` });
      window.scrollTo({ top: document.getElementById("shop")?.offsetTop ?? 0, behavior: "smooth" });
    } catch (e: any) { setFail(e.message); } finally { setBusy(null); }
  }

  return (
    <>
      <Hero
        kicker="Customer · the shop"
        title="Shop the" script="network"
        lead="Pick what you need. We find the warehouse that can ship it best, lock the stock so nobody else can take it, and confirm your order in one atomic step."
        variant="crates" accent={ROLE_META.customer.accent}
        belt={["Routed to the best warehouse", "Stock locked for you", "No overselling, ever"]}
        chips={[{ label: "Products", value: String(products?.length ?? "—") }, { label: "Warehouses", value: "4" }]}
        actions={<><button className="btn primary big" onClick={() => document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" })}>Start shopping</button><button className="btn big" onClick={() => go("myorders")}>My orders</button></>}
      />
      <section className="chapter ch-ink" id="shop">
        <div className="wrap">
          <LoadFail error={error} />
          <div aria-live="polite">
            {receipt && (
              <div className="receipt" role="status">
                <span className="receipt-ic"><Icon name="check" size={26} /></span>
                <div>
                  <strong>Order #{receipt.id} confirmed</strong>
                  <p>{receipt.qty} × {receipt.product} · {inr(receipt.total)}. Routed to <b>{receipt.warehouse}</b>. Stock was locked and deducted in one transaction.</p>
                </div>
                <button className="btn" onClick={() => go("myorders")}>Track it</button>
              </div>
            )}
            {fail && <Notice kind="err" onClose={() => setFail("")}>{fail}</Notice>}
          </div>
          <div className="toolbar">
            <label className="search"><span className="sr">Search products</span><input type="search" placeholder="Search products" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
            <Chips label="Category" value={cat} onChange={setCat} options={[{ v: "all", label: "All" }, ...cats.map((c) => ({ v: c, label: c }))]} />
          </div>
          {!products ? <Skeleton rows={5} /> : (
            <div className="products">
              {shown.map((p: any, i: number) => (
                <article className="product" key={p.id} style={{ ["--i" as any]: i % 6 }}>
                  <div className="product-art" aria-hidden="true"><span>{p.category}</span><b>{p.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}</b></div>
                  <h3>{p.name}</h3>
                  <p className="muted">{p.sku}</p>
                  <div className="product-buy">
                    <strong>{inr(Number(p.price))}</strong>
                    <div className="stepper-qty" role="group" aria-label={`Quantity for ${p.name}`}>
                      <button type="button" onClick={() => setQty({ ...qty, [p.id]: Math.max(1, (qty[p.id] ?? 1) - 1) })} aria-label="Decrease quantity">−</button>
                      <output>{qty[p.id] ?? 1}</output>
                      <button type="button" onClick={() => setQty({ ...qty, [p.id]: Math.min(20, (qty[p.id] ?? 1) + 1) })} aria-label="Increase quantity">+</button>
                    </div>
                  </div>
                  <button className="btn primary full" disabled={busy === p.id} onClick={() => buy(p)}>{busy === p.id ? "Allocating…" : `Order ${qty[p.id] ?? 1}`}</button>
                </article>
              ))}
              {shown.length === 0 && <div className="empty"><strong>Nothing matches</strong><p>Try another search or category.</p></div>}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
