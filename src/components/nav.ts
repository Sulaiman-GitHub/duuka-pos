import type { Permission } from "@/lib/permissions";

export const NAV: { href: string; label: string; perm: Permission; icon: string }[] = [
  { href: "/dashboard", label: "Dashboard", perm: "dashboard.view", icon: "LayoutDashboard" },
  { href: "/pos", label: "Point of Sale", perm: "pos.sell", icon: "ShoppingCart" },
  { href: "/sales", label: "Sales", perm: "sales.view", icon: "Receipt" },
  { href: "/products", label: "Products", perm: "inventory.view", icon: "Package" },
  { href: "/inventory", label: "Inventory", perm: "inventory.view", icon: "Boxes" },
  { href: "/suppliers", label: "Suppliers & Orders", perm: "suppliers.manage", icon: "Truck" },
  { href: "/reports", label: "Reports", perm: "reports.view", icon: "BarChart3" },
  { href: "/users", label: "Users", perm: "users.manage", icon: "Users" },
  { href: "/audit", label: "Activity log", perm: "audit.view", icon: "History" },
  { href: "/settings", label: "Settings", perm: "settings.manage", icon: "Settings" },
];
