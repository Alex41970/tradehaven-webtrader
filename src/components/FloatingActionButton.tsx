import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, Plus, Minus, Bot, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingActionButtonProps {
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onTrade?: () => void;
  onBot?: () => void;
  className?: string;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onDeposit,
  onWithdraw,
  onTrade,
  onBot,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  const actions = [
    {
      icon: TrendingUp,
      label: 'Quick Trade',
      onClick: onTrade,
      className: 'bg-trading-primary hover:bg-trading-primary/90 text-white',
    },
    {
      icon: Plus,
      label: 'Deposit',
      onClick: onDeposit,
      className: 'bg-trading-success hover:bg-trading-success/90 text-white',
    },
    {
      icon: Minus,
      label: 'Withdraw',
      onClick: onWithdraw,
      className: 'bg-trading-danger hover:bg-trading-danger/90 text-white',
    },
    {
      icon: Bot,
      label: 'Trading Bot',
      onClick: onBot,
      className: 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white',
    },
  ];

  return (
    <TooltipProvider>
      <div className={cn("fixed bottom-6 right-6 z-50", className)}>
        <div className="flex flex-col-reverse items-end space-y-reverse space-y-3">
          {/* Action Buttons */}
          {isOpen && (
            <div className="flex flex-col-reverse space-y-reverse space-y-3 animate-fade-in-up">
              {actions.map((action, index) => (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      className={cn(
                        "h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110",
                        action.className
                      )}
                      onClick={() => {
                        action.onClick?.();
                        setIsOpen(false);
                      }}
                      style={{
                        animationDelay: `${index * 50}ms`,
                      }}
                    >
                      <action.icon className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="bg-popover border border-border/50">
                    <p className="text-sm font-medium">{action.label}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}

          {/* Main Toggle Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className={cn(
                  "h-14 w-14 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 bg-gradient-to-r from-primary via-primary to-primary/80 hover:from-primary/90 hover:via-primary/90 hover:to-primary/70 text-white animate-bounce-gentle",
                  isOpen && "rotate-45"
                )}
                onClick={toggleMenu}
              >
                {isOpen ? (
                  <X className="h-6 w-6 transition-transform duration-300" />
                ) : (
                  <Menu className="h-6 w-6 transition-transform duration-300" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-popover border border-border/50">
              <p className="text-sm font-medium">Quick Actions</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};