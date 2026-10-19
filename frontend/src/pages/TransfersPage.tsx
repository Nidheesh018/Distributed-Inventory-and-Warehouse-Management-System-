import { useMemo, useState } from "react";
import { loadSnapshot } from "../services/api";
import { useLoad } from "../lib/hooks";
import { isOpenTransfer, needsMyAction } from "../lib/metrics";
import TransferCard, { useTransferActions } from "../components/transfer";
import { Chips, Empty, Notice, PageHead, Skeleton } from "../components/ui";

type Tab = "mine" | "motion" | "done";

export default function TransfersPage({ role, warehouseId }: { role: string; warehouseId?: number | null }) {
  const { data: s, error, reload } = useLoad(loadSnapshot, [], 15000);
  const actions = useTransferActions(reload);
  const all = s?.transfers ?? [];
  const mine = useMemo(() => all.filter((t) => needsMyAction(t, role, warehouseId)), [all, role, warehouseId]);
  const motion = useMemo(() => all.filter((t) => isOpenTransfer(t) && !needsMyAction(t, role, warehouseId)), [all, role, warehouseId]);
  const done = useMemo(() => all.filter((t) => !isOpenTransfer(t)), [all]);
  const [tab, setTab] = useState<Tab | null>(null);
  const active: Tab = tab ?? (mine.length ? "mine" : motion.length ? "motion" : "done");
  const list = active === "mine" ? mine : active === "motion" ? motion : done;
  const oversight = role === "owner" || role === "admin";

  return (
    <div className="wrap page">
      <PageHead kicker="Controlled stock movement" title="Transfer" em="control" lead="Every request follows the same four steps, and every step is signed by the person responsible for it." />
      <ol className="flow4" aria-label="Transfer workflow">
        <li><b>01</b><strong>Request</strong><span>Source proposes product and quantity; stock is reserved.</span></li>
        <li><b>02</b><strong>Approve</strong><span>Destination manager accepts or rejects.</span></li>
        <li><b>03</b><strong>Dispatch</strong><span>Source manager confirms the shipment left.</span></li>
        <li><b>04</b><strong>Receive</strong><span>Destination confirms arrival; stock is added.</span></li>
      </ol>
      {actions.message && <Notice onClose={actions.clear}>{actions.message}</Notice>}
      {(actions.error || error) && <Notice kind="err" onClose={actions.clear}>{actions.error || error}</Notice>}
      <div className="toolbar">
        <Chips<Tab> label="Transfer lists" value={active} onChange={setTab} options={[{ v: "mine", label: oversight ? "Can act on" : "Needs my action", count: mine.length }, { v: "motion", label: "In motion", count: motion.length }, { v: "done", label: "Closed", count: done.length }]} />
      </div>
      {!s ? <Skeleton rows={5} /> : list.length === 0 ? (
        <Empty title={active === "mine" ? "Nothing waiting on you" : active === "motion" ? "Nothing in motion" : "No closed transfers yet"} body={active === "mine" ? "New requests addressed to you appear here the moment they are raised." : "Start a transfer from the Inventory page."} />
      ) : <div className="tlist">{list.map((t) => <TransferCard key={t.id} t={t} role={role} warehouseId={warehouseId} busy={actions.busy} onAct={actions.act} />)}</div>}
    </div>
  );
}
