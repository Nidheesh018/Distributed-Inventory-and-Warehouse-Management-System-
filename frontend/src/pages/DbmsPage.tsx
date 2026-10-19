import { PageHead, Reveal } from "../components/ui";

const CONCEPTS = [
  ["3NF relational design", "Separate entities for users, customers, warehouses, products, inventory, orders, transfers and audit data."],
  ["ACID transactions", "Orders and transfers run as atomic database transactions. A failure rolls back the whole unit of work."],
  ["Row-level locking", "Inventory rows are selected with SELECT … FOR UPDATE before stock is deducted."],
  ["Integrity constraints", "Primary keys, foreign keys, unique rules and CHECK constraints protect the invariants."],
  ["JWT + RBAC", "Authenticated users receive JWTs; every protected route enforces owner / admin / manager / customer roles server-side."],
  ["Explainable allocation", "Candidate warehouse scores are persisted, so the final allocation can be inspected and defended."],
];
const TIMELINE = ["A begins", "A locks the row", "A deducts to 1", "A commits", "B locks", "B re-checks", "B gets “insufficient stock”"];

export default function DbmsPage() {
  return (
    <div className="wrap page">
      <PageHead kicker="DBMS lab" title="Database concepts," em="made visible" lead="These are the mechanisms the implementation really uses, not slideware." />
      <div className="grid g3">
        {CONCEPTS.map(([t, b], i) => (
          <Reveal key={t} className="card concept" delay={i * 50}><span className="badge b-info">Implemented</span><h3>{t}</h3><p>{b}</p></Reveal>
        ))}
      </div>
      <Reveal className="card scenario">
        <h3>Concurrent order scenario</h3>
        <p className="muted">5 units available · Customer A requests 4 · Customer B requests 4.</p>
        <ol className="timeline">{TIMELINE.map((s, i) => <li key={s} className={i === TIMELINE.length - 1 ? "last" : ""}><b>{i + 1}</b>{s}</li>)}</ol>
      </Reveal>
    </div>
  );
}
