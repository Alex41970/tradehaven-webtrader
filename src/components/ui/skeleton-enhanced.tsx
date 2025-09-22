import * as React from "react"
import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'shimmer' | 'pulse'
}

function Skeleton({
  className,
  variant = 'shimmer',
  ...props
}: SkeletonProps) {
  const variants = {
    default: "animate-pulse bg-muted",
    shimmer: "bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-[shimmer_2s_infinite]",
    pulse: "animate-pulse bg-muted"
  }

  return (
    <div
      className={cn(
        "rounded-md",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

// Enhanced skeleton variants for trading components
const TradingCardSkeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-4 border rounded-lg bg-card", className)} {...props}>
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-8 w-24" />
      <div className="flex space-x-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  </div>
)

const AssetRowSkeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-3 border rounded-lg bg-muted/20", className)} {...props}>
    <div className="flex items-center justify-between">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </div>
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="text-right space-y-1">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  </div>
)

const ChartSkeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-4 border rounded-lg bg-card h-[400px] relative overflow-hidden", className)} {...props}>
    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-muted/20 to-transparent animate-[shimmer_3s_infinite]" />
    <div className="space-y-4 relative z-10">
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="h-64 relative">
        {/* Mock chart lines */}
        <div className="absolute inset-0 flex items-end justify-between px-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton 
              key={i} 
              className="w-2 bg-primary/20" 
              style={{ height: `${Math.random() * 80 + 20}%` }}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  </div>
)

export { 
  Skeleton, 
  TradingCardSkeleton, 
  AssetRowSkeleton, 
  ChartSkeleton 
}