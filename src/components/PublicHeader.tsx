import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/markets", label: "Markets" },
  { to: "/education", label: "Education" },
  { to: "/about", label: "About" },
  { to: "/support", label: "Support" },
  { to: "/contact", label: "Contact" },
];

export const PublicHeader = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
        <Link to="/" aria-label="Home" className="min-w-0 shrink"><Logo size="sm" className="sm:hidden" /><Logo size="md" className="hidden sm:flex" /></Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn("rounded-md px-3 py-2 text-sm transition-colors hover:text-foreground",
                  isActive ? "text-primary" : "text-muted-foreground")
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => navigate("/auth")}>Sign in</Button>
          <Button size="sm" className="sm:h-10 sm:px-4" onClick={() => navigate("/auth")}>Open account<ArrowRight className="ml-1 hidden h-4 w-4 sm:inline" /></Button>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-border bg-background px-4 py-3 lg:hidden">
          {[...NAV, { to: "/auth", label: "Sign in" }].map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
};
