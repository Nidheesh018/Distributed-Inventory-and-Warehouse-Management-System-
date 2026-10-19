import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "./components/AppShell";
import Login from "./pages/Login";
import OwnerDashboard from "./pages/OwnerDashboard";
import ManagersPage from "./pages/ManagersPage";
import ManagerHome from "./pages/ManagerHome";
import OpsHome from "./pages/OpsHome";
import WarehousesPage from "./pages/WarehousesPage";
import InventoryPage from "./pages/InventoryPage";
import OrdersPage from "./pages/OrdersPage";
import TransfersPage from "./pages/TransfersPage";
import CustomerPortal from "./pages/CustomerPortal";
import DbmsPage from "./pages/DbmsPage";
import { getMe, getTransfers, getWarehouses, isDemoMode } from "./services/api";
import { DEMO_USER, resetDemoState } from "./services/demoData";
import { allowedPages, homeOf } from "./lib/roles";
import { hoursBetween, needsMyAction, OVERDUE_HOURS } from "./lib/metrics";

type User = { id: number; name: string; email: string; role: string; customer_id: number | null; warehouse_id?: number | null };

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState("");
  const [ctx, setCtx] = useState<any>(undefined);
  const [loading, setLoading] = useState(true);
  const [badge, setBadge] = useState(0);
  const [whName, setWhName] = useState("");
  const [tick, setTick] = useState(0);

  const start = (u: User) => { setUser(u); setPage(homeOf(u.role)); setCtx(undefined); };

  useEffect(() => {
    if (isDemoMode()) {
      const raw = localStorage.getItem("distribustock_demo_user");
      start(raw ? JSON.parse(raw) : (DEMO_USER as User)); setLoading(false); return;
    }
    if (!localStorage.getItem("inventory_token")) { setLoading(false); return; }
    getMe().then((u: User) => start(u)).catch(() => localStorage.removeItem("inventory_token")).finally(() => setLoading(false));
  }, []);

  // nav badge: what needs this person (manager) or what is overdue (owner/admin)
  useEffect(() => {
    if (!user || user.role === "customer") { setBadge(0); return; }
    let alive = true;
    const run = () => Promise.all([getTransfers(), getWarehouses()]).then(([t, w]) => {
      if (!alive) return;
      const n = user.role === "warehouse_manager"
        ? t.filter((x: any) => needsMyAction(x, user.role, user.warehouse_id)).length
        : t.filter((x: any) => { const st = String(x.status).toUpperCase(); const since = st === "PENDING_DESTINATION_APPROVAL" ? x.created_at : st === "PENDING_SOURCE_DISPATCH" ? x.destination_approved_at : st === "IN_TRANSIT" ? x.source_dispatched_at : null; return since && (hoursBetween(since, Date.now()) ?? 0) > OVERDUE_HOURS; }).length;
      setBadge(n); setWhName(w.find((x: any) => x.id === user.warehouse_id)?.name ?? "");
    }).catch(() => {});
    run();
    const id = window.setInterval(run, 20000);
    return () => { alive = false; window.clearInterval(id); };
  }, [user, tick, page]);

  const go = useCallback((p: string, c?: any) => { setPage(p); setCtx(c); }, []);
  const badges = useMemo(() => ({ transfers: badge } as Record<string, number>), [badge]);

  function logout() {
    ["inventory_token", "distribustock_demo", "distribustock_demo_user"].forEach((k) => localStorage.removeItem(k));
    setUser(null); setPage(""); setBadge(0);
  }

  if (loading) return <div className="loading"><i className="pulse" /> Loading secure workspace…</div>;
  if (!user) return <Login onLogin={start} />;

  const role = user.role;
  const safe = allowedPages(role).includes(page) ? page : homeOf(role);
  const wid = user.warehouse_id;
  const view = (() => {
    switch (safe) {
      case "owner": return <OwnerDashboard user={user} go={go} />;
      case "managers": return <ManagersPage go={go} />;
      case "dashboard": return role === "warehouse_manager" ? <ManagerHome user={user} go={go} /> : <OpsHome user={user} go={go} />;
      case "warehouses": return <WarehousesPage role={role} warehouseId={wid} go={go} />;
      case "inventory": return <InventoryPage role={role} warehouseId={wid} ctx={ctx} />;
      case "orders": case "myorders": return <OrdersPage role={role} />;
      case "transfers": return <TransfersPage role={role} warehouseId={wid} />;
      case "customer": return <CustomerPortal user={user} go={go} />;
      case "dbms": return <DbmsPage />;
      default: return null;
    }
  })();

  return (
    <AppShell user={user} page={safe} go={go} onLogout={logout} badges={badges} demo={isDemoMode()} warehouseName={whName}
      onResetDemo={() => { resetDemoState(); setTick((t) => t + 1); setPage(homeOf(role)); window.location.reload(); }}>
      {view}
    </AppShell>
  );
}
