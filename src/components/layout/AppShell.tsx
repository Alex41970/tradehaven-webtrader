import { ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { ChevronsLeft, LogOut, LucideIcon, Menu } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

export type NavItem = { id: string; label: string; icon: LucideIcon; onClick?: () => void };

interface AppShellProps {
  nav: NavItem[];
  active: string;
  onNavigate: (id: string) => void;
  topbar?: ReactNode;
  footer?: ReactNode;
  /** Tighter page padding, for screens that need every pixel (trading). */
  dense?: boolean;
  /** Open this screen with the menu already slim; the trader can still widen it. */
  autoCollapse?: boolean;
  /** Ids shown in the phone tab bar (max 4); everything else goes under "More". */
  mobilePrimary?: string[];
  onSignOut?: () => void;
  children: ReactNode;
}

/** Shared app frame: collapsible sidebar on desktop, bottom tab bar on phones. */
export const AppShell = ({ nav, active, onNavigate, topbar, footer, onSignOut, children, dense, autoCollapse, mobilePrimary }: AppShellProps) => {
  // Width-hungry screens (trading) start slim; the trader's own click wins until they switch screen.
  const [manual, setManual] = useState<boolean | null>(null);
  useEffect(() => { setManual(null); }, [autoCollapse]);
  const collapsed = manual ?? !!autoCollapse;
  const [moreOpen, setMoreOpen] = useState(false);
  const go = (n: NavItem) => { setMoreOpen(false); n.onClick ? n.onClick() : onNavigate(n.id); };
  const primary = mobilePrimary ? nav.filter((n) => mobilePrimary.includes(n.id)).slice(0, 4) : nav.slice(0, 4);
  const rest = nav.filter((n) => !primary.includes(n));
  const tabs = rest.length ? primary.length + 1 : primary.length;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-[72px]" : "w-60")}>
        <div className="flex h-16 items-center justify-between px-4">
          {collapsed ? <Logo size="sm" iconOnly /> : <Logo size="md" />}
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {nav.map((n) => {
            const on = n.id === active;
            return (
              <button key={n.id} onClick={() => go(n)} title={n.label}
                className={cn("group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  on ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground")}>
                {on && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />}
                <n.icon className={cn("h-[18px] w-[18px] shrink-0", on && "text-primary")} />
                {!collapsed && <span className="truncate">{n.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-sidebar-border p-3">
          {!collapsed && footer}
          {onSignOut && (
            <button onClick={onSignOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-[18px] w-[18px] shrink-0" />{!collapsed && "Sign out"}
            </button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setManual(!collapsed)} className="w-full justify-center text-muted-foreground">
            <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-3 md:h-16 md:px-4 backdrop-blur-xl md:px-6">
          <div className="md:hidden"><Logo size="sm" iconOnly /></div>
          {topbar}
        </header>
        <main className={cn("flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-3 md:pt-4 md:pb-8 md:pt-6", dense ? "px-2 md:px-3 md:pb-4 md:pt-4" : "px-3 md:px-6")}>{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        style={{ gridTemplateColumns: `repeat(${tabs}, minmax(0, 1fr))` }}>
        {primary.map((n) => (
          <button key={n.id} onClick={() => go(n)}
            className={cn("flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px]", n.id === active ? "text-primary" : "text-muted-foreground")}>
            <n.icon className="h-5 w-5" />{n.label}
          </button>
        ))}
        {rest.length > 0 && (
          <button onClick={() => setMoreOpen(true)}
            className={cn("flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px]", rest.some((n) => n.id === active) ? "text-primary" : "text-muted-foreground")}>
            <Menu className="h-5 w-5" />More
          </button>
        )}
      </nav>
      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent className="pb-[env(safe-area-inset-bottom)] md:hidden">
          <DrawerHeader className="text-left"><DrawerTitle>Menu</DrawerTitle></DrawerHeader>
          <div className="grid grid-cols-3 gap-2 px-4">
            {rest.map((n) => (
              <button key={n.id} onClick={() => go(n)}
                className={cn("flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 text-xs",
                  n.id === active ? "border-primary/50 text-primary" : "text-foreground")}>
                <n.icon className="h-5 w-5" />{n.label}
              </button>
            ))}
          </div>
          <div className="space-y-2 p-4">
            {footer}
            {onSignOut && (
              <Button variant="outline" className="h-11 w-full text-destructive" onClick={() => { setMoreOpen(false); onSignOut(); }}>
                <LogOut className="mr-2 h-4 w-4" />Sign out
              </Button>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
