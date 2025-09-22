import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, TrendingUp, Briefcase, History } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const TradingBurgerMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const menuItems = [
    {
      title: "Web Trader",
      icon: TrendingUp,
      path: "/webtrader",
      description: "Advanced trading interface with charts and market data"
    },
    {
      title: "Portfolio",
      icon: Briefcase,
      path: "/webtrader/portfolio",
      description: "View your positions, P&L, and portfolio metrics"
    },
    {
      title: "Trading History",
      icon: History,
      path: "/webtrader/trading-history",
      description: "Review your past trades and transactions"
    }
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="lg" className="w-full">
          <Menu className="h-5 w-5 mr-2" />
          Trading Tools
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trading Tools
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {menuItems.map((item) => (
            <Button
              key={item.path}
              variant="ghost"
              className="w-full h-auto p-4 flex flex-col items-start text-left hover:bg-muted/50"
              onClick={() => handleNavigation(item.path)}
            >
              <div className="flex items-center gap-3 w-full">
                <item.icon className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium text-base">{item.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {item.description}
                  </div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};