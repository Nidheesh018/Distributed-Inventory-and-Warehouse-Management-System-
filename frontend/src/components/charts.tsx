import { useId } from "react";

/* Small, dependency-free charts. Hand-rolled SVG keeps the bundle light and
 * lets every chart respect the role theme through CSS variables. */

export function AreaChart({ data, format, label }: { data: { label: string; value: number }[]; format?: (n: number) => string; label: string }) {
  const id = useId().replace(/:/g, "");
  const W = 640, H = 220, padX = 8, padT = 18, padB = 30;
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = format || ((n: number) => n.toLocaleString("en-IN"));
  const x = (i: number) => padX + (i * (W - padX * 2)) / Math.max(1, data.length - 1);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1)} ${H - padB} L${x(0)} ${H - padB} Z`;
  const peak = data.reduce((p, d, i) => (d.value > data[p].value ? i : p), 0);
  return (
    <figure className="chart" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity=".45" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((k) => <line key={k} x1={padX} x2={W - padX} y1={padT + (1 - k) * (H - padT - padB)} y2={padT + (1 - k) * (H - padT - padB)} className="grid-line" />)}
        <path d={area} fill={`url(#g${id})`} />
        <path d={line} className="area-line" />
        {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r={i === peak ? 5 : 3} className={i === peak ? "dot peak" : "dot"}><title>{`${d.label}: ${fmt(d.value)}`}</title></circle>)}
      </svg>
      <div className="axis-x">{data.map((d, i) => <span key={i}>{d.label}</span>)}</div>
      <figcaption>Peak <strong>{fmt(data[peak]?.value ?? 0)}</strong> on {data[peak]?.label}</figcaption>
    </figure>
  );
}

export function BarList({ items, format }: { items: { label: string; sub?: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const fmt = format || ((n: number) => n.toLocaleString("en-IN"));
  return (
    <ul className="barlist">
      {items.map((i) => (
        <li key={i.label}>
          <div className="bl-top"><strong>{i.label}</strong><span>{fmt(i.value)}</span></div>
          <div className="bl-track"><i style={{ width: `${(i.value / max) * 100}%` }} /></div>
          {i.sub && <small>{i.sub}</small>}
        </li>
      ))}
    </ul>
  );
}

export const SERIES_COLORS = ["#ffd23f", "#8f84ff", "#46e3b0", "#ff7a59", "#5ec8ff", "#ff6fb1"];

export function Radar({ axes, series, label }: { axes: string[]; series: { name: string; values: number[] }[]; label: string }) {
  const S = 340, cx = S / 2, cy = S / 2 + 4, R = 112;
  const n = axes.length;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)] as const;
  };
  return (
    <figure className="chart radar" aria-label={label}>
      <svg viewBox={`-70 0 ${S + 140} ${S}`} role="img" aria-label={label}>
        {[25, 50, 75, 100].map((k) => <polygon key={k} points={axes.map((_, i) => pt(i, k).join(",")).join(" ")} className="grid-line" fill="none" />)}
        {axes.map((a, i) => { const [x, y] = pt(i, 100); const [lx, ly] = pt(i, 128); return <g key={a}><line x1={cx} y1={cy} x2={x} y2={y} className="grid-line" /><text x={lx} y={ly} textAnchor={lx < cx - 8 ? "end" : lx > cx + 8 ? "start" : "middle"} dominantBaseline="middle" className="axis-label">{a}</text></g>; })}
        {series.map((s, si) => {
          const c = SERIES_COLORS[si % SERIES_COLORS.length];
          return <polygon key={s.name} points={s.values.map((v, i) => pt(i, v).join(",")).join(" ")} fill={c} fillOpacity=".16" stroke={c} strokeWidth="2.2" strokeLinejoin="round"><title>{s.name}</title></polygon>;
        })}
      </svg>
      <ul className="legend">{series.map((s, i) => <li key={s.name}><i style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />{s.name}</li>)}</ul>
    </figure>
  );
}
