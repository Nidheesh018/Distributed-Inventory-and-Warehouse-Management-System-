export type Role = "owner" | "admin" | "warehouse_manager" | "customer";

export type NavItem = { key: string; label: string; icon: string };

export const ROLE_META: Record<Role, { label: string; home: string; accent: number; nav: NavItem[]; blurb: string }> = {
  owner: {
    label: "Owner",
    home: "owner",
    accent: 0xffd23f,
    blurb: "Company-wide analytics, every warehouse manager's scorecard, transfer oversight.",
    nav: [
      { key: "owner", label: "Command", icon: "grid" },
      { key: "managers", label: "Managers", icon: "users" },
      { key: "warehouses", label: "Warehouses", icon: "building" },
      { key: "inventory", label: "Inventory", icon: "box" },
      { key: "orders", label: "Orders", icon: "receipt" },
      { key: "transfers", label: "Transfers", icon: "swap" },
    ],
  },
  admin: {
    label: "Admin",
    home: "dashboard",
    accent: 0x8f84ff,
    blurb: "System operations, the full network, and the DBMS lab behind it.",
    nav: [
      { key: "dashboard", label: "Operations", icon: "grid" },
      { key: "inventory", label: "Inventory", icon: "box" },
      { key: "warehouses", label: "Warehouses", icon: "building" },
      { key: "orders", label: "Orders", icon: "receipt" },
      { key: "transfers", label: "Transfers", icon: "swap" },
      { key: "dbms", label: "DBMS Lab", icon: "db" },
    ],
  },
  warehouse_manager: {
    label: "Warehouse manager",
    home: "dashboard",
    accent: 0xc8ff4d,
    blurb: "Your warehouse only: your queue, your stock, your scorecard.",
    nav: [
      { key: "dashboard", label: "My warehouse", icon: "grid" },
      { key: "inventory", label: "Inventory", icon: "box" },
      { key: "orders", label: "Orders", icon: "receipt" },
      { key: "transfers", label: "Transfers", icon: "swap" },
      { key: "warehouses", label: "Network", icon: "building" },
    ],
  },
  customer: {
    label: "Customer",
    home: "customer",
    accent: 0xff5a36,
    blurb: "Shop the network. Every order is routed to the best warehouse for you.",
    nav: [
      { key: "customer", label: "Shop", icon: "bag" },
      { key: "myorders", label: "My orders", icon: "receipt" },
    ],
  },
};

export const roleOf = (r: string): Role => (r in ROLE_META ? (r as Role) : "admin");
export const allowedPages = (role: string) => ROLE_META[roleOf(role)].nav.map((n) => n.key);
export const homeOf = (role: string) => ROLE_META[roleOf(role)].home;
export const accentHex = (role: string) => "#" + ROLE_META[roleOf(role)].accent.toString(16).padStart(6, "0");
