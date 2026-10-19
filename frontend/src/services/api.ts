import { DEMO_USER, getDemoUser, loadDemoState, saveDemoState } from "./demoData";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
export const isDemoMode = () => localStorage.getItem("distribustock_demo") === "1";

function demoRequest(path: string, options: RequestInit = {}) {
  const state = loadDemoState();
  if (path === "/auth/me") return Promise.resolve(getDemoUser());
  const user = getDemoUser();
  const visibleWarehouses = user.role === "warehouse_manager" ? state.warehouses.filter(w => w.id === user.warehouse_id) : state.warehouses;
  const visibleInventory = user.role === "warehouse_manager" ? state.inventory.filter(x => x.warehouse_id === user.warehouse_id) : state.inventory;
  const visibleOrders = user.role === "warehouse_manager" ? state.orders.filter(o => o.selected_warehouse_id === user.warehouse_id) : user.role === "customer" ? state.orders.filter(o => o.customer_id === user.customer_id) : state.orders;
  if (path === "/dashboard") return Promise.resolve({products: state.products.length, warehouses: visibleWarehouses.length, orders: visibleOrders.length, total_stock: visibleInventory.reduce((sum, x) => sum + Number(x.available_quantity), 0)});
  if (path === "/inventory") return Promise.resolve(visibleInventory);
  if (path === "/products") return Promise.resolve(state.products);
  if (path === "/warehouses") return Promise.resolve(state.warehouses.map(w => ({...w})));
  if (path === "/orders" && options.method !== "POST") return Promise.resolve([...visibleOrders].sort((a,b) => b.id - a.id));
  if (path === "/transactions") return Promise.resolve((user.role === "warehouse_manager" ? state.transactions.filter(t=>t.warehouse_id===user.warehouse_id) : state.transactions).map(t=>({...t,type:t.transaction_type})).sort((a,b) => b.id - a.id));
  if (path === "/transfers" && (!options.method || options.method === "GET")) return Promise.resolve((state.transfers || []).filter(t=> user.role !== "warehouse_manager" || t.source_warehouse_id===user.warehouse_id || t.destination_warehouse_id===user.warehouse_id).slice().sort((a,b)=>b.id-a.id).map(t=>({...t,product:state.products.find(p=>p.id===t.product_id)?.name,source_warehouse:state.warehouses.find(w=>w.id===t.source_warehouse_id)?.name,destination_warehouse:state.warehouses.find(w=>w.id===t.destination_warehouse_id)?.name})));
  if (path === "/transfers" && options.method === "POST") {
    const payload = JSON.parse(String(options.body || "{}"));
    const src = state.inventory.find(x => x.product_id === payload.product_id && x.warehouse_id === payload.source_warehouse_id);
    const dst = state.inventory.find(x => x.product_id === payload.product_id && x.warehouse_id === payload.destination_warehouse_id);
    if (!src || !dst) throw new Error("Inventory row missing for one or both warehouses.");
    if (payload.source_warehouse_id === payload.destination_warehouse_id) throw new Error("Source and destination warehouses must be different.");
    if (payload.quantity <= 0 || src.available_quantity < payload.quantity) throw new Error("Insufficient available stock in source warehouse.");
    if (user.role === "warehouse_manager" && user.warehouse_id !== payload.source_warehouse_id) throw new Error("You can only request transfers from your assigned warehouse.");
    const id = state.nextTransferId++;
    src.reserved_quantity = Number(src.reserved_quantity || 0) + Number(payload.quantity); src.available_quantity -= Number(payload.quantity);
    const t = {id,product_id:payload.product_id,source_warehouse_id:payload.source_warehouse_id,destination_warehouse_id:payload.destination_warehouse_id,quantity:payload.quantity,status:"PENDING_DESTINATION_APPROVAL",requested_by:user.name,requested_by_user_id:user.id,reason:payload.reason||"Stock balancing",created_at:new Date().toISOString()};
    state.transfers.unshift(t); saveDemoState(state); return Promise.resolve({id,status:t.status});
  }
  const transferAction = path.match(/^\/transfers\/(\d+)\/(approve|reject|dispatch|receive)$/);
  if (transferAction && options.method === "POST") {
    const t = (state.transfers || []).find(x=>x.id===Number(transferAction[1])); if(!t) throw new Error("Transfer request not found.");
    const action=transferAction[2], destination=user.warehouse_id===t.destination_warehouse_id, source=user.warehouse_id===t.source_warehouse_id, elevated=["owner","admin"].includes(user.role);
    if(action==="approve"){if(!elevated&&!(user.role==="warehouse_manager"&&destination))throw new Error("Only the destination warehouse manager can approve this request.");if(t.status!=="PENDING_DESTINATION_APPROVAL")throw new Error("This request is not awaiting approval.");t.status="PENDING_SOURCE_DISPATCH";t.destination_approved_by_user_id=user.id;t.destination_approved_at=new Date().toISOString();}
    if(action==="reject"){if(!elevated&&!(user.role==="warehouse_manager"&&destination))throw new Error("Only the destination warehouse manager can reject this request.");if(t.status!=="PENDING_DESTINATION_APPROVAL")throw new Error("This request is not awaiting approval.");const src=state.inventory.find(x=>x.product_id===t.product_id&&x.warehouse_id===t.source_warehouse_id);if(src){src.reserved_quantity=Math.max(0,Number(src.reserved_quantity||0)-t.quantity);src.available_quantity+=t.quantity;}t.status="REJECTED";t.rejected_by_user_id=user.id;t.rejected_at=new Date().toISOString();}
    if(action==="dispatch"){if(!elevated&&!(user.role==="warehouse_manager"&&source))throw new Error("Only the source warehouse manager can dispatch this transfer.");if(t.status!=="PENDING_SOURCE_DISPATCH")throw new Error("Transfer must be approved before dispatch.");const src=state.inventory.find(x=>x.product_id===t.product_id&&x.warehouse_id===t.source_warehouse_id);if(!src||Number(src.reserved_quantity||0)<t.quantity||src.quantity<t.quantity)throw new Error("Reserved source stock is no longer available.");src.quantity-=t.quantity;src.reserved_quantity=Math.max(0,Number(src.reserved_quantity||0)-t.quantity);t.status="IN_TRANSIT";t.source_dispatched_by_user_id=user.id;t.source_dispatched_at=new Date().toISOString();const id=state.nextTransactionId++;state.transactions.unshift({id,transaction_type:"TRANSFER_OUT",product_id:t.product_id,warehouse_id:t.source_warehouse_id,quantity:-t.quantity,reference_type:"TRANSFER",reference_id:t.id,user_id:user.id,created_at:new Date().toISOString()});}
    if(action==="receive"){if(!elevated&&!(user.role==="warehouse_manager"&&destination))throw new Error("Only the destination warehouse manager can confirm receipt.");if(t.status!=="IN_TRANSIT")throw new Error("Transfer must be dispatched before receipt.");const dst=state.inventory.find(x=>x.product_id===t.product_id&&x.warehouse_id===t.destination_warehouse_id);if(!dst)throw new Error("Destination inventory row is missing.");dst.quantity+=t.quantity;dst.available_quantity+=t.quantity;t.status="COMPLETED";t.received_by_user_id=user.id;t.received_at=new Date().toISOString();t.completed_at=t.received_at;const id=state.nextTransactionId++;state.transactions.unshift({id,transaction_type:"TRANSFER_IN",product_id:t.product_id,warehouse_id:t.destination_warehouse_id,quantity:t.quantity,reference_type:"TRANSFER",reference_id:t.id,user_id:user.id,created_at:new Date().toISOString()});}
    saveDemoState(state); return Promise.resolve({id:t.id,status:t.status});
  }
  if (path === "/products" && options.method === "POST") {
    const payload = JSON.parse(String(options.body || "{}"));
    const sku = String(payload.sku ?? "").trim().toUpperCase();
    const name = String(payload.name ?? "").trim();
    const category = String(payload.category ?? "").trim();
    const price = Number(payload.price);
    const reorderLevel = payload.reorder_level === undefined ? 5 : Number(payload.reorder_level);
    const initialStock = payload.initial_stock ?? {};
    if (!sku || !name || !category) throw new Error("SKU, name and category are required.");
    if (state.products.some(p => String(p.sku).toUpperCase() === sku)) throw new Error("SKU already exists.");
    if (!Number.isFinite(price) || price < 0) throw new Error("Price must be a non-negative number.");
    if (!Number.isInteger(reorderLevel) || reorderLevel < 0) throw new Error("Reorder level must be a non-negative integer.");
    if (!initialStock || typeof initialStock !== "object" || Array.isArray(initialStock)) throw new Error("Initial stock must be a warehouse-to-quantity object.");
    const allowedWarehouses = user.role === "warehouse_manager"
      ? state.warehouses.filter(w => w.id === user.warehouse_id)
      : state.warehouses;
    if (user.role === "warehouse_manager" && allowedWarehouses.length === 0) throw new Error("No warehouse is assigned to this manager.");
    const allowedIds = new Set(allowedWarehouses.map(w => String(w.id)));
    const invalidWarehouse = Object.keys(initialStock).find(id => !allowedIds.has(id));
    if (invalidWarehouse !== undefined) throw new Error(`Unknown or unauthorized warehouse id: ${invalidWarehouse}.`);
    for (const [warehouseId, rawQty] of Object.entries(initialStock)) {
      const qty = Number(rawQty);
      if (!Number.isInteger(qty) || qty < 0) throw new Error(`Initial stock for warehouse ${warehouseId} must be a non-negative integer.`);
    }
    const id = Math.max(0, ...state.products.map(p => p.id)) + 1;
    const p = {id, sku, name, category, price, reorder_level:reorderLevel};
    state.products.push(p);
    allowedWarehouses.forEach(w => {
      const qty = Number(initialStock[w.id] ?? 0);
      state.inventory.push({
        inventory_id:Math.max(0, ...state.inventory.map(x => x.inventory_id)) + 1,
        product_id:id, product:p.name, sku:p.sku, warehouse_id:w.id, warehouse:w.name,
        quantity:qty, reserved_quantity:0, available_quantity:qty,
        reorder_level:p.reorder_level, low_stock:qty<=p.reorder_level
      });
    });
    saveDemoState(state);
    return Promise.resolve(p);
  }
  if (path.startsWith("/orders/") && path.endsWith("/allocation")) return Promise.resolve(state.allocationDecisions.filter(x => x.order_id === Number(path.split("/")[2])));
  if (path === "/auth/login") return Promise.resolve({access_token: "demo-mode", user});
  throw new Error(`Demo mode does not implement ${path}`);
}

async function request(path: string, options: RequestInit = {}) {
  if (isDemoMode()) return demoRequest(path, options);
  const token = localStorage.getItem("inventory_token");
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, {...options, headers});
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || `Request failed (${response.status})`);
  return body;
}

export function login(email: string, password: string) { return request("/auth/login", {method:"POST", body:JSON.stringify({email,password})}); }
export function getMe() { return request("/auth/me"); }
export function getDashboard() { return request("/dashboard"); }
export function getInventory() { return request("/inventory"); }
export function getProducts() { return request("/products"); }
export function getWarehouses() { return request("/warehouses"); }
export function getOrders() { return request("/orders"); }
export function getAllocation(orderId:number) { return request(`/orders/${orderId}/allocation`); }
export function getTransactions() { return request("/transactions"); }
export function createOrder(customerId:number | null, productId:number, quantity:number) {
  if (!isDemoMode()) return request("/orders", {method:"POST", body:JSON.stringify({customer_id:customerId, items:[{product_id:productId, quantity}]})});
  const state = loadDemoState(); const product = state.products.find(p => p.id === productId); if (!product) throw new Error("Product not found.");
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantity must be a positive integer.");
  const candidates = state.inventory.filter(x => x.product_id === productId && x.available_quantity >= quantity).map(x => {
    const wh = state.warehouses.find(w => w.id === x.warehouse_id); const availability = x.available_quantity / Math.max(quantity,1);
    const priority = Number(x.priority ?? wh?.priority ?? 0) / 100; const load = wh ? Number(wh.current_load ?? 0) / Math.max(Number(wh.capacity ?? 1),1) : 0; const loadScore = Math.max(0,1-load);
    return {...x, availability, score: availability*.55 + priority*.25 + loadScore*.20};
  }).sort((a,b)=>b.score-a.score);
  const selected=candidates[0]; if(!selected) throw new Error("Demo simulation: insufficient stock across the network.");
  const warehouse=state.warehouses.find(w=>w.id===selected.warehouse_id)!; const orderId=state.nextOrderId++;
  selected.quantity-=quantity; selected.available_quantity-=quantity; selected.low_stock=selected.available_quantity <= Number(product.reorder_level ?? 10);
  const order={id:orderId,customer_id:customerId ?? DEMO_USER.customer_id,customer_name:getDemoUser().name,status:"ALLOCATED",selected_warehouse_id:selected.warehouse_id,total_amount:Number(product.price)*quantity,created_at:new Date().toISOString()};
  state.orders.unshift(order); state.transactions.unshift({id:state.nextTransactionId++,transaction_type:"ORDER_DEBIT",product_id:productId,warehouse_id:selected.warehouse_id,quantity:-quantity,reference_type:"ORDER",reference_id:orderId,user_id:getDemoUser().id,created_at:new Date().toISOString()});
  state.allocationDecisions.unshift({order_id:orderId,warehouse_id:selected.warehouse_id,warehouse:warehouse.name,stock_score:Math.round(selected.availability*100),priority_score:warehouse.priority,load_score:Math.round((1-warehouse.current_load/warehouse.capacity)*100),final_score:0});
  state.allocationDecisions[0].final_score=Math.round(state.allocationDecisions[0].stock_score*.55+state.allocationDecisions[0].priority_score*.25+state.allocationDecisions[0].load_score*.20); saveDemoState(state);
  return Promise.resolve({id:orderId,selected_warehouse_id:selected.warehouse_id,selected_warehouse:warehouse.name,status:order.status});
}

export function transferStock(productId:number, sourceWarehouseId:number, destinationWarehouseId:number, quantity:number, reason?:string) {
  return request("/transfers", {method:"POST", body:JSON.stringify({product_id:productId, source_warehouse_id:sourceWarehouseId, destination_warehouse_id:destinationWarehouseId, quantity, reason})});
}
export function getTransfers() { return request("/transfers"); }
export function approveTransfer(id:number) { return request(`/transfers/${id}/approve`, {method:"POST"}); }
export function rejectTransfer(id:number) { return request(`/transfers/${id}/reject`, {method:"POST"}); }
export function dispatchTransfer(id:number) { return request(`/transfers/${id}/dispatch`, {method:"POST"}); }
export function receiveTransfer(id:number) { return request(`/transfers/${id}/receive`, {method:"POST"}); }

export function createProduct(payload:{sku:string;name:string;category:string;price:number;reorder_level:number;description?:string;initial_stock?:Record<number,number>}) {
  return request("/products", {method:"POST", body:JSON.stringify(payload)});
}

export async function loadSnapshot() {
  const [inventory, orders, warehouses, transfers, transactions, products] = await Promise.all([getInventory(), getOrders(), getWarehouses(), getTransfers(), getTransactions(), getProducts()]);
  return { inventory, orders, warehouses, transfers, transactions, products } as { inventory: any[]; orders: any[]; warehouses: any[]; transfers: any[]; transactions: any[]; products: any[] };
}
export type Snapshot = Awaited<ReturnType<typeof loadSnapshot>>;
