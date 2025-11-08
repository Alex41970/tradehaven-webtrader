import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  iconOnly?: boolean;
}

const sizeMap = {
  sm: { container: "h-6", icon: "h-6 w-6", text: "text-sm" },
  md: { container: "h-8", icon: "h-8 w-8", text: "text-base" },
  lg: { container: "h-10", icon: "h-10 w-10", text: "text-lg" },
  xl: { container: "h-12", icon: "h-12 w-12", text: "text-xl" },
};

export const Logo = ({ size = "md", className, iconOnly = false }: LogoProps) => {
  const sizes = sizeMap[size];

  return (
    <div className={cn("flex items-center gap-2", sizes.container, className)}>
      {/* Icon - Geometric "LCI" lettermark */}
      <svg
        className={sizes.icon}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* L - Angular upward shape */}
        <path
          d="M15 20 L15 65 L35 65 L35 75 L5 75 L5 20 Z"
          fill="hsl(var(--accent))"
          className="transition-colors"
        />
        
        {/* C - Curved momentum */}
        <path
          d="M55 75 C40 75 30 65 30 47.5 C30 30 40 20 55 20 L60 20 L60 30 L55 30 C45 30 40 37 40 47.5 C40 58 45 65 55 65 L60 65 L60 75 Z"
          fill="hsl(var(--primary))"
          className="transition-colors"
        />
        
        {/* I - Vertical stability with upward accent */}
        <path
          d="M75 20 L85 20 L85 75 L75 75 Z"
          fill="hsl(var(--accent))"
          className="transition-colors"
        />
        <path
          d="M75 20 L85 20 L80 10 Z"
          fill="hsl(var(--primary))"
          className="transition-colors opacity-80"
        />
      </svg>

      {/* Text */}
      {!iconOnly && (
        <span className={cn("font-bold tracking-tight", sizes.text)}>
          Lexington Capital
        </span>
      )}
    </div>
  );
};
