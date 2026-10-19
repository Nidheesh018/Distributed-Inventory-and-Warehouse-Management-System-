import { loadSnapshot } from "../services/api";
import { useLoad } from "../lib/hooks";
import { isOpenTransfer } from "../lib/metrics";
import { LoadFail, WarehouseTile } from "../components/blocks";
import { PageHead, Reveal, Skeleton } from "../components/ui";

export default function WarehousesPage({ role, warehouseId, go }: { role: string; warehouseId?: number | null; go: (p: string, ctx?: any) => void }) {
  const { data: s, error } = useLoad(loadSnapshot, [], 30000);
  return (
    <div className="wrap page">
      <PageHead kicker={role === "warehouse_manager" ? "The network" : "Network"} title="The" em="warehouses" lead={role === "warehouse_manager" ? "Every location in the network and who runs it. You can request transfers from your own warehouse to any of them." : "Every location, who runs it, how full it is and what is moving. Select one to open its inventory."} />
      <LoadFail error={error} />
      {!s ? <Skeleton rows={6} /> : (
        <div className="wtiles big">
          {s.warehouses.map((w, i) => (
            <Reveal key={w.id} delay={i * 50}>
              <WarehouseTile limited={role === "warehouse_manager" && w.id !== warehouseId} w={w} units={s.inventory.filter((x) => x.warehouse_id === w.id).reduce((a, x) => a + Number(x.quantity || 0), 0)} low={s.inventory.filter((x) => x.warehouse_id === w.id && x.low_stock).length} open={s.transfers.filter((t) => isOpenTransfer(t) && (t.source_warehouse_id === w.id || t.destination_warehouse_id === w.id)).length} onClick={role === "warehouse_manager" && w.id !== warehouseId ? undefined : () => go("inventory", { warehouse: w.name })} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
