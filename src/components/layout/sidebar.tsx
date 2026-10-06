"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Store,
  Truck,
  Warehouse,
  FileText,
  BarChart3,
  Download,
  Settings,
  Factory,
  ClipboardList,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

type NavGroup = {
  title?: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Sales",
    items: [
      { label: "Retailers", href: "/retailers", icon: Store },
      { label: "Delivery Orders", href: "/delivery-orders", icon: Truck },
      { label: "Invoices", href: "/invoices", icon: FileText },
      { label: "Sell-Through", href: "/sell-through", icon: BarChart3 },
    ],
  },
  {
    title: "Supply",
    items: [
      { label: "Products", href: "/products", icon: Package },
      { label: "Suppliers", href: "/suppliers", icon: Factory },
      { label: "Supplier Orders", href: "/supplier-orders", icon: ClipboardList },
      { label: "Inventory", href: "/inventory", icon: Warehouse },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Finance", href: "/finance", icon: Wallet, adminOnly: true },
      { label: "Reports", href: "/reports", icon: BarChart3 },
      { label: "Export", href: "/export", icon: Download },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function SidebarContent({ role }: { role?: "admin" | "staff" }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex flex-col px-6 pb-4 pt-6">
        <Image
          src="/soycraft-wordmark.png"
          alt="Soycraft logo"
          width={150}
          height={34}
          className="object-contain"
          priority
        />
        <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          B2B Console
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {navGroups.map((group, gi) => {
          const visible = group.items.filter(
            (item) => !item.adminOnly || role === "admin",
          );
          if (visible.length === 0) return null;
          return (
            <div key={group.title ?? gi}>
              {group.title && (
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.title}
                </p>
              )}
              <div className="space-y-0.5">
                {visible.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {isActive && (
                        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
                      )}
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          isActive
                            ? "text-primary"
                            : "text-muted-foreground/70 group-hover:text-foreground",
                        )}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t px-6 py-3">
        <p className="text-[11px] text-muted-foreground">
          Soycraft B2B{role === "admin" ? " · Admin" : role === "staff" ? " · Staff" : ""}
        </p>
      </div>
    </div>
  );
}

export function Sidebar({ role }: { role?: "admin" | "staff" }) {
  return (
    <aside className="sticky top-0 hidden h-screen bg-muted/20 lg:flex lg:w-64 lg:flex-col lg:border-r">
      <SidebarContent role={role} />
    </aside>
  );
}
