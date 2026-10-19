import { useState } from "react";
import { approveTransfer, dispatchTransfer, receiveTransfer, rejectTransfer } from "../services/api";
import { Badge, BadgeTone, Icon } from "./ui";
import { OVERDUE_HOURS, ago, dur, hoursBetween, transferNeeds } from "../lib/metrics";

export const STATUS: Record<string, { label: string; tone: BadgeTone; step: number }> = {
  PENDING: { label: "Pending approval", tone: "info", step: 1 },
  PENDING_DESTINATION_APPROVAL: { label: "Awaiting approval", tone: "info", step: 1 },
  PENDING_SOURCE_DISPATCH: { label: "Approved · awaiting dispatch", tone: "warn", step: 2 },
  IN_TRANSIT: { label: "In transit", tone: "warn", step: 3 },
  COMPLETED: { label: "Completed", tone: "good", step: 4 },
  REJECTED: { label: "Rejected", tone: "bad", step: 1 },
  FAILED: { label: "Failed", tone: "bad", step: 1 },
};
const STEPS = ["Requested", "Approved", "Dispatched", "Received"];

/** Runs one transfer action and keeps feedback + busy state. */
export function useTransferActions(reload: () => any) {
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function act(id: number, fn: (id: number) => Promise<any>, label: string) {
    setBusy(id); setError(""); setMessage("");
    try { await fn(id); setMessage(`Transfer #${id} ${label}.`); await reload(); }
    catch (e: any) { setError(e?.message || "That action failed."); }
    finally { setBusy(null); }
  }
  return { busy, message, error, act, clear: () => { setMessage(""); setError(""); } };
}

export function waitingOn(t: any, now = Date.now()) {
  const st = String(t.status).toUpperCase();
  if (st === "PENDING_DESTINATION_APPROVAL" || st === "PENDING") return { who: t.destination_warehouse || `Warehouse #${t.destination_warehouse_id}`, need: "approval", h: hoursBetween(t.created_at, now) };
  if (st === "PENDING_SOURCE_DISPATCH") return { who: t.source_warehouse || `Warehouse #${t.source_warehouse_id}`, need: "dispatch", h: hoursBetween(t.destination_approved_at, now) };
  if (st === "IN_TRANSIT") return { who: t.destination_warehouse || `Warehouse #${t.destination_warehouse_id}`, need: "receipt", h: hoursBetween(t.source_dispatched_at, now) };
  return null;
}

export default function TransferCard({ t, role, warehouseId, busy, onAct }: { t: any; role: string; warehouseId?: number | null; busy: number | null; onAct: (id: number, fn: (id: number) => Promise<any>, label: string) => void }) {
  const st = String(t.status).toUpperCase();
  const meta = STATUS[st] || { label: st, tone: "plain" as BadgeTone, step: 1 };
  const need = transferNeeds(t, role, warehouseId);
  const wait = waitingOn(t);
  const overdue = !!wait && (wait.h ?? 0) > OVERDUE_HOURS;
  const mine = need.approve || need.dispatch || need.receive;
  const disabled = busy === t.id;
  return (
    <article className={`tcard${overdue ? " overdue" : ""}${mine ? " mine" : ""}`}>
      <header className="tcard-head">
        <div>
          <p className="kicker">Transfer #{t.id} · {t.product || `Product #${t.product_id}`} × {t.quantity}</p>
          <h3>{t.source_warehouse || `Warehouse #${t.source_warehouse_id}`} <span className="arrow"><Icon name="arrow" size={18} /></span> {t.destination_warehouse || `Warehouse #${t.destination_warehouse_id}`}</h3>
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </header>

      <ol className={`stepper${st === "REJECTED" ? " rejected" : ""}`} aria-label="Transfer progress">
        {STEPS.map((s, i) => (
          <li key={s} className={i < meta.step && st !== "REJECTED" ? "done" : i === meta.step && st !== "REJECTED" && st !== "COMPLETED" ? "now" : ""}>
            <i>{i < meta.step && st !== "REJECTED" ? <Icon name="check" size={13} /> : i + 1}</i><span>{s}</span>
          </li>
        ))}
      </ol>

      <dl className="tmeta">
        <div><dt>Requested by</dt><dd>{t.requested_by || "—"}</dd></div>
        <div><dt>Requested</dt><dd>{ago(t.created_at)}</dd></div>
        <div><dt>Reason</dt><dd>{t.reason || "Stock balancing"}</dd></div>
        {wait && <div className={overdue ? "late" : ""}><dt>Waiting on</dt><dd>{wait.who} · {wait.need} · {dur(wait.h)}{overdue ? " (overdue)" : ""}</dd></div>}
        {t.received_at && <div><dt>Received</dt><dd>{ago(t.received_at)}</dd></div>}
        {t.rejected_at && <div><dt>Rejected</dt><dd>{ago(t.rejected_at)}</dd></div>}
      </dl>

      <div className="tactions">
        {need.approve && <><button className="btn primary" disabled={disabled} onClick={() => onAct(t.id, approveTransfer, "approved")}>Approve request</button><button className="btn danger" disabled={disabled} onClick={() => onAct(t.id, rejectTransfer, "rejected")}>Reject</button></>}
        {need.dispatch && <button className="btn primary" disabled={disabled} onClick={() => onAct(t.id, dispatchTransfer, "dispatched")}>Confirm dispatch</button>}
        {need.receive && <button className="btn primary" disabled={disabled} onClick={() => onAct(t.id, receiveTransfer, "received")}>Confirm receipt</button>}
        {!mine && <span className="muted">{["COMPLETED", "REJECTED", "FAILED"].includes(st) ? "Closed" : wait ? `Waiting for ${wait.who}` : "No action needed from you"}</span>}
      </div>
    </article>
  );
}
