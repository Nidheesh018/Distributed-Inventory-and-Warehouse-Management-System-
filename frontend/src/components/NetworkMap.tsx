import { isOpenTransfer } from "../lib/metrics";

/* A real map of the business: nodes = warehouses (sized by units held,
 * ringed by how full they are), animated routes = transfers in flight. */

const CITY_XY: Record<string, [number, number]> = {
  delhi: [470, 80], mumbai: [140, 235], hyderabad: [480, 245], bengaluru: [350, 395], bangalore: [350, 395], chennai: [580, 400], kolkata: [690, 150], pune: [215, 310],
};

function layout(warehouses: any[]) {
  const cities = warehouses.map((w) => String(w.city || "").toLowerCase());
  const known = cities.every((c) => CITY_XY[c]) && new Set(cities).size === cities.length;
  return warehouses.map((w, i) => {
    if (known) return CITY_XY[cities[i]];
    const a = (Math.PI * 2 * i) / Math.max(1, warehouses.length) - Math.PI / 2;
    return [400 + Math.cos(a) * 240, 235 + Math.sin(a) * 150] as [number, number];
  });
}

export default function NetworkMap({ warehouses, inventory, transfers, onSelect }: { warehouses: any[]; inventory: any[]; transfers: any[]; onSelect?: (w: any) => void }) {
  const pos = layout(warehouses);
  const units = warehouses.map((w) => inventory.filter((x) => x.warehouse_id === w.id).reduce((s, x) => s + Number(x.quantity || 0), 0));
  const maxUnits = Math.max(1, ...units);
  const idx = (id: number) => warehouses.findIndex((w) => w.id === id);
  const live = transfers.filter(isOpenTransfer).filter((t) => idx(t.source_warehouse_id) >= 0 && idx(t.destination_warehouse_id) >= 0);

  return (
    <div className="netmap">
      <svg viewBox="0 0 800 470" role="img" aria-label={`Network map of ${warehouses.length} warehouses with ${live.length} transfers in flight`}>
        <defs><pattern id="nm-dots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" className="nm-dot" /></pattern></defs>
        <rect width="800" height="470" fill="url(#nm-dots)" />
        {pos.map((a, i) => pos.slice(i + 1).map((b, j) => <line key={`${i}-${j}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="nm-mesh" />))}
        {live.map((t) => {
          const a = pos[idx(t.source_warehouse_id)], b = pos[idx(t.destination_warehouse_id)];
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - 34;
          return (
            <g key={t.id} className={`nm-route st-${String(t.status).toLowerCase()}`}>
              <path d={`M${a[0]} ${a[1]} Q${mx} ${my} ${b[0]} ${b[1]}`} className="nm-flow" />
              <g transform={`translate(${(a[0] + 2 * mx + b[0]) / 4} ${(a[1] + 2 * my + b[1]) / 4})`}><rect x="-17" y="-11" width="34" height="22" rx="11" className="nm-tag" /><text textAnchor="middle" dominantBaseline="central" className="nm-tag-t">×{t.quantity}</text></g>
              <title>{`Transfer #${t.id}: ${t.quantity} × ${t.product ?? "units"}`}</title>
            </g>
          );
        })}
        {warehouses.map((w, i) => {
          const [x, y] = pos[i];
          const r = 18 + (units[i] / maxUnits) * 20;
          const left = x < 300;
          const lx = left ? x - r - 20 : x + r + 20;
          const util = w.capacity && w.current_load ? Number(w.current_load) / Number(w.capacity) : 0;
          const tone = util > 0.85 ? "bad" : util > 0.7 ? "warn" : "good";
          const c = 2 * Math.PI * (r + 7);
          return (
            <g key={w.id} className={`nm-node t-${tone}`} tabIndex={onSelect ? 0 : -1} role={onSelect ? "button" : undefined} aria-label={`${w.name}: ${units[i]} units, ${Math.round(util * 100)}% full`} onClick={() => onSelect?.(w)} onKeyDown={(e) => { if (onSelect && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(w); } }}>
              <circle cx={x} cy={y} r={r + 7} className="nm-ring-track" />
              <circle cx={x} cy={y} r={r + 7} className="nm-ring" strokeDasharray={`${c * Math.min(1, util)} ${c}`} transform={`rotate(-90 ${x} ${y})`} />
              <circle cx={x} cy={y} r={r} className="nm-core" />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="nm-units">{units[i]}</text>
              <text x={lx} y={y - 4} textAnchor={left ? "end" : "start"} className="nm-name">{w.code || w.name}</text>
              <text x={lx} y={y + 14} textAnchor={left ? "end" : "start"} className="nm-city">{w.city}</text>
            </g>
          );
        })}
      </svg>
      <p className="netmap-note"><span><i className="d good" />under 70% full</span><span><i className="d warn" />70–85%</span><span><i className="d bad" />over 85%</span><span><i className="d flow" />transfer in flight</span></p>
    </div>
  );
}
