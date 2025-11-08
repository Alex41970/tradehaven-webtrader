import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  iconOnly?: boolean;
}

const sizeMap = {
  sm: { 
    text: "text-base",
    primary: "text-[10px]",
    tracking: "tracking-[0.15em]"
  },
  md: { 
    text: "text-xl",
    primary: "text-xs",
    tracking: "tracking-[0.12em]"
  },
  lg: { 
    text: "text-2xl",
    primary: "text-sm",
    tracking: "tracking-[0.12em]"
  },
  xl: { 
    text: "text-3xl",
    primary: "text-base",
    tracking: "tracking-[0.12em]"
  },
};

export const Logo = ({ size = "md", className, iconOnly = false }: LogoProps) => {
  const sizes = sizeMap[size];

  if (iconOnly) {
    return (
      <div className={cn("flex items-center", className)}>
        <span className={cn(
          "font-montserrat font-bold",
          sizes.text,
          sizes.tracking,
          "bg-gradient-to-r from-accent via-accent to-primary bg-clip-text text-transparent"
        )}>
          LC
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col justify-center", className)}>
      <div className="flex items-baseline gap-2">
        <span className={cn(
          "font-montserrat font-bold",
          sizes.text,
          "text-foreground"
        )}>
          LEXINGTON
        </span>
        <span className={cn(
          "font-montserrat font-semibold",
          sizes.text,
          "bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent"
        )}>
          CAPITAL
        </span>
      </div>
      <span className={cn(
        "font-montserrat font-medium",
        sizes.primary,
        sizes.tracking,
        "text-muted-foreground -mt-1"
      )}>
        INVESTING
      </span>
    </div>
  );
};
