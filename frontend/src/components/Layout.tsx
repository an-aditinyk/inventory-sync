import { ReactNode } from "react";
import { useLocation } from "wouter";
import { LayoutDashboard, Plus, History, ScrollText, Settings, RefreshCw } from "lucide-react";
import { cn } from "../lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/new-sync", label: "New Sync", icon: Plus },
  { href: "/history", label: "History", icon: History },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Sidebar() {
  const [location, navigate] = useLocation();
  return (
    <aside className="w-60 min-h-screen flex flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-md bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <RefreshCw className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold text-sidebar-foreground tracking-tight">SyncOps</p>
          <p className="text-xs text-sidebar-foreground/50">Inventory Sync</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-widest px-3 mb-2">
          Navigation
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <a
              key={href}
              href={href}
              data-testid={`nav-${label.toLowerCase().replace(" ", "-")}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(href);
              }}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </a>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/40 font-medium">Last synced</p>
        <p className="text-xs text-sidebar-foreground/60 mt-0.5">Oct 27, 2023 — 08:02 AM</p>
      </div>
    </aside>
  );
}

export function Layout({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border bg-card px-8 py-5">
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </header>
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
