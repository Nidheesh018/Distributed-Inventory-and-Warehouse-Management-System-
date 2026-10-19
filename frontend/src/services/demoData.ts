export type DemoState = {
  products: any[];
  warehouses: any[];
  inventory: any[];
  orders: any[];
  transactions: any[];
  allocationDecisions: any[];
  transfers: any[];
  nextTransferId: number;
  nextOrderId: number;
  nextTransactionId: number;
};

/* ------------------------------------------------------------------ *
 * Demo seed
 * Deterministic (seeded PRNG) and relative to "now", so the owner's
 * charts always show the last two weeks and each manager has a
 * genuinely different performance profile:
 *   Aarav  (HYD) fast + reliable      Isha   (BLR) solid
 *   Kabir  (MUM) slower, some stuck   Ananya (DEL) overdue + low stock
 * ------------------------------------------------------------------ */

const HOUR = 3_600_000;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRODUCTS = [
  { id: 1, sku: "LAP-001", name: "AeroBook Pro 14", category: "Laptops", price: 74999, reorder_level: 10 },
  { id: 2, sku: "MON-027", name: "Vision 27 4K", category: "Monitors", price: 32999, reorder_level: 8 },
  { id: 3, sku: "KEY-114", name: "MechBoard X", category: "Peripherals", price: 8999, reorder_level: 15 },
  { id: 4, sku: "SSD-512", name: "FlashCore 1TB", category: "Storage", price: 8499, reorder_level: 12 },
  { id: 5, sku: "HUB-009", name: "LinkHub Pro", category: "Accessories", price: 4999, reorder_level: 20 },
  { id: 6, sku: "CAM-220", name: "VisionCam 4K", category: "Cameras", price: 12999, reorder_level: 8 },
  { id: 7, sku: "AUD-310", name: "Noise-X Headphones", category: "Audio", price: 15999, reorder_level: 10 },
  { id: 8, sku: "PWR-020", name: "PowerCell 20K", category: "Accessories", price: 3499, reorder_level: 18 },
];

const WAREHOUSES = [
  { id: 1, code: "HYD-01", name: "Hyderabad Central", city: "Hyderabad", priority: 96, capacity: 5000, current_load: 3150, status: "ONLINE", manager_user_id: 11, manager_name: "Aarav Sharma" },
  { id: 2, code: "BLR-02", name: "Bengaluru South", city: "Bengaluru", priority: 88, capacity: 6200, current_load: 4030, status: "ONLINE", manager_user_id: 12, manager_name: "Isha Reddy" },
  { id: 3, code: "MUM-03", name: "Mumbai West", city: "Mumbai", priority: 82, capacity: 4800, current_load: 1750, status: "ONLINE", manager_user_id: 13, manager_name: "Kabir Mehta" },
  { id: 4, code: "DEL-04", name: "Delhi North", city: "Delhi", priority: 79, capacity: 7000, current_load: 6420, status: "ONLINE", manager_user_id: 14, manager_name: "Ananya Rao" },
];

// on-hand quantity per product x warehouse (HYD, BLR, MUM, DEL)
const QTY: Record<number, [number, number, number, number]> = {
  1: [42, 28, 19, 9],
  2: [16, 21, 26, 6],
  3: [63, 71, 44, 11],
  4: [38, 34, 29, 7],
  5: [74, 52, 61, 14],
  6: [24, 17, 9, 11],
  7: [31, 26, 22, 5],
  8: [88, 64, 70, 16],
};
const BASE_RESERVED = [3, 2, 2, 1];

// [id, product, src, dst, qty, status, createdHoursAgo, approveDelayH, dispatchDelayH, receiveDelayH, reason]
type TSeed = [number, number, number, number, number, string, number, number | null, number | null, number | null, string];
const TRANSFERS: TSeed[] = [
  [74, 1, 1, 4, 6, "COMPLETED", 300, 1.5, 3, 5, "Delhi laptop demand spike"],
  [75, 3, 2, 3, 12, "COMPLETED", 270, 4, 6, 9, "Rebalance keyboards"],
  [76, 4, 1, 3, 10, "COMPLETED", 240, 2, 2.5, 8, "Restock SSDs"],
  [77, 2, 3, 4, 5, "COMPLETED", 200, 20, 30, 22, "Monitor shortfall in Delhi"],
  [78, 5, 2, 1, 14, "COMPLETED", 170, 5, 4, 6, "Hub overflow to Hyderabad"],
  [79, 7, 3, 2, 6, "COMPLETED", 140, 12, 18, 14, "Audio balancing"],
  [80, 6, 1, 4, 4, "COMPLETED", 110, 2.5, 3, 20, "Camera restock"],
  [81, 8, 2, 4, 20, "REJECTED", 96, 6, null, null, "Power banks"],
  [82, 4, 2, 1, 8, "COMPLETED", 72, 1, 2, 4, "SSD rebalance"],
  [83, 1, 2, 3, 5, "COMPLETED", 60, 16, 22, 15, "Laptop seed stock for Mumbai"],
  [84, 3, 4, 3, 6, "PENDING_SOURCE_DISPATCH", 52, 30, null, null, "Keyboards for Mumbai retail"],
  [85, 7, 2, 4, 8, "PENDING_DESTINATION_APPROVAL", 31, null, null, null, "Audio shortfall in Delhi"],
  [86, 2, 3, 1, 4, "PENDING_DESTINATION_APPROVAL", 5, null, null, null, "Rebalance monitors"],
  [87, 4, 1, 4, 5, "IN_TRANSIT", 14, 1.5, 2, null, "Rebalance low stock"],
];

// per-warehouse order profile: [orders, completion probability]
const ORDER_PROFILE: Record<number, [number, number]> = { 1: [15, 0.95], 2: [12, 0.88], 3: [9, 0.72], 4: [8, 0.5] };

const iso = (ms: number) => new Date(ms).toISOString();

export function buildInitialState(): DemoState {
  const now = Date.now();
  const rand = rng(20261010);
  const products = PRODUCTS.map((p) => ({ ...p }));
  const warehouses = WAREHOUSES.map((w) => ({ ...w }));

  // ---- inventory matrix (every product x every warehouse) ----
  let invId = 100;
  const inventory: any[] = [];
  products.forEach((p) => {
    warehouses.forEach((w, wi) => {
      const quantity = QTY[p.id][wi];
      const reserved = Math.min(quantity, BASE_RESERVED[wi] + (p.id % 2));
      invId += 1;
      inventory.push({ inventory_id: invId, product_id: p.id, product: p.name, sku: p.sku, warehouse_id: w.id, warehouse: w.name, quantity, reserved_quantity: reserved, available_quantity: quantity - reserved, reorder_level: p.reorder_level, low_stock: quantity - reserved <= p.reorder_level });
    });
  });

  // ---- transfers + audit transactions ----
  const transactions: any[] = [];
  const transfers = TRANSFERS.map(([id, product_id, src, dst, qty, status, ago, dApprove, dDispatch, dReceive, reason]) => {
    const created = now - ago * HOUR;
    const srcMgr = warehouses[src - 1].manager_user_id;
    const dstMgr = warehouses[dst - 1].manager_user_id;
    const t: any = { id, product_id, source_warehouse_id: src, destination_warehouse_id: dst, quantity: qty, status, reason, created_at: iso(created), requested_by: warehouses[src - 1].manager_name, requested_by_user_id: srcMgr };
    let cursor = created;
    if (status === "REJECTED" && dApprove != null) { t.rejected_at = iso(cursor + dApprove * HOUR); t.rejected_by_user_id = dstMgr; }
    if (status !== "PENDING_DESTINATION_APPROVAL" && status !== "REJECTED" && dApprove != null) { cursor += dApprove * HOUR; t.destination_approved_at = iso(cursor); t.destination_approved_by_user_id = dstMgr; }
    if ((status === "IN_TRANSIT" || status === "COMPLETED") && dDispatch != null) {
      cursor += dDispatch * HOUR; t.source_dispatched_at = iso(cursor); t.source_dispatched_by_user_id = srcMgr;
      transactions.push({ transaction_type: "TRANSFER_OUT", product_id, warehouse_id: src, quantity: -qty, reference_type: "TRANSFER", reference_id: id, user_id: srcMgr, created_at: iso(cursor) });
    }
    if (status === "COMPLETED" && dReceive != null) {
      cursor += dReceive * HOUR; t.received_at = iso(cursor); t.completed_at = iso(cursor); t.received_by_user_id = dstMgr;
      transactions.push({ transaction_type: "TRANSFER_IN", product_id, warehouse_id: dst, quantity: qty, reference_type: "TRANSFER", reference_id: id, user_id: dstMgr, created_at: iso(cursor) });
    }
    if (status === "PENDING_DESTINATION_APPROVAL" || status === "PENDING_SOURCE_DISPATCH") {
      const row = inventory.find((x) => x.product_id === product_id && x.warehouse_id === src);
      if (row) { row.reserved_quantity += qty; row.available_quantity = Math.max(0, row.quantity - row.reserved_quantity); row.low_stock = row.available_quantity <= row.reorder_level; }
    }
    return t;
  });

  // ---- orders (14 days) + debit transactions ----
  const orders: any[] = [];
  const customers: [number, string][] = [[3, "Demo Customer"], [4, "Riya Patel"], [5, "Vikram Singh"], [6, "Neha Kapoor"], [7, "Arjun Nair"]];
  Object.entries(ORDER_PROFILE).forEach(([whId, [count, doneP]]) => {
    for (let i = 0; i < count; i++) {
      const hoursAgo = 3 + rand() * 24 * 13.5;
      const p = products[Math.floor(rand() * products.length)];
      const qty = 1 + Math.floor(rand() * 3);
      const [cid, cname] = customers[Math.floor(rand() * customers.length)];
      const old = hoursAgo > 52;
      const done = hoursAgo > 20 ? rand() < doneP : false;
      const cancelled = old && !done && rand() < 0.18;
      orders.push({ id: 0, customer_id: cid, customer_name: cname, status: cancelled ? "CANCELLED" : done ? "COMPLETED" : "ALLOCATED", selected_warehouse_id: Number(whId), total_amount: p.price * qty, created_at: iso(now - hoursAgo * HOUR), _p: p.id, _q: qty });
    }
  });
  orders.sort((a, b) => a.created_at.localeCompare(b.created_at));
  let orderId = 1000;
  orders.forEach((o) => {
    o.id = ++orderId;
    if (o.status !== "CANCELLED") transactions.push({ transaction_type: "ORDER_DEBIT", product_id: o._p, warehouse_id: o.selected_warehouse_id, quantity: -o._q, reference_type: "ORDER", reference_id: o.id, user_id: o.customer_id, created_at: o.created_at });
    delete o._p; delete o._q;
  });
  orders.reverse();
  transactions.sort((a, b) => b.created_at.localeCompare(a.created_at));
  transactions.forEach((t, i) => { t.id = 9000 - i; });

  return { products, warehouses, inventory, orders, transactions, allocationDecisions: [], transfers: transfers.reverse(), nextTransferId: 88, nextOrderId: orderId + 1, nextTransactionId: 9001 };
}

export const DEMO_STATE_KEY = "distribustock_demo_state_v2";

export function loadDemoState(): DemoState {
  try {
    const raw = localStorage.getItem(DEMO_STATE_KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch (_) { /* fall through to a fresh seed */ }
  const state = buildInitialState();
  localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
  return state;
}

export function saveDemoState(state: DemoState) {
  localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
}

export function resetDemoState() {
  const state = buildInitialState();
  localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
  return state;
}

export function ensureDemoState() {
  if (!localStorage.getItem(DEMO_STATE_KEY)) resetDemoState();
}

export const DEMO_USERS = {
  owner: { id: 1, name: "Dhanush", email: "owner@distribustock.local", role: "owner", customer_id: null, warehouse_id: null },
  admin: { id: 2, name: "System Admin", email: "admin@distribustock.local", role: "admin", customer_id: null, warehouse_id: null },
  manager1: { id: 11, name: "Aarav Sharma", email: "manager.hyd@distribustock.local", role: "warehouse_manager", customer_id: null, warehouse_id: 1 },
  manager2: { id: 12, name: "Isha Reddy", email: "manager.blr@distribustock.local", role: "warehouse_manager", customer_id: null, warehouse_id: 2 },
  manager3: { id: 13, name: "Kabir Mehta", email: "manager.mum@distribustock.local", role: "warehouse_manager", customer_id: null, warehouse_id: 3 },
  manager4: { id: 14, name: "Ananya Rao", email: "manager.del@distribustock.local", role: "warehouse_manager", customer_id: null, warehouse_id: 4 },
  customer: { id: 3, name: "Demo Customer", email: "customer@distribustock.local", role: "customer", customer_id: 3, warehouse_id: null },
};
export const DEMO_USER = DEMO_USERS.admin;
export function getDemoUser() {
  try { const raw = localStorage.getItem("distribustock_demo_user"); if (raw) return JSON.parse(raw); } catch (_) { /* use default */ }
  return DEMO_USER;
}
