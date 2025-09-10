import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
  glassmorphism?: boolean;
  glow?: boolean;
  gradient?: boolean;
}

export const PremiumCard: React.FC<PremiumCardProps> = ({
  children,
  className,
  glassmorphism = false,
  glow = false,
  gradient = false
}) => {
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-2xl",
        glassmorphism && [
          "bg-gradient-to-br from-white/[0.08] to-white/[0.03]",
          "backdrop-blur-xl border border-white/[0.15]",
          "shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]"
        ],
        glow && "shadow-[0_0_20px_hsl(var(--primary)/0.4)]",
        gradient && "bg-gradient-to-br from-card via-card to-card/80",
        !glassmorphism && !gradient && "bg-card",
        className
      )}
    >
      {gradient && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      )}
      {children}
    </Card>
  );
};

export const PremiumCardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className
}) => (
  <CardHeader className={cn("relative z-10", className)}>
    {children}
  </CardHeader>
);

export const PremiumCardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className
}) => (
  <CardContent className={cn("relative z-10", className)}>
    {children}
  </CardContent>
);