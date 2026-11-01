import { cn } from "@/lib/utils";

interface ResizeHandleProps {
  /** Which edge of the panel the handle sits on. */
  side: "left" | "right";
  onPointerDown: (event: React.PointerEvent) => void;
  label: string;
  dragging?: boolean;
  /** When to show it — panels stack on small screens, so the handle must hide with them. */
  showClassName?: string;
}

/** Thin grip between panels: drag it to set your own panel width. */
export const ResizeHandle = ({ side, onPointerDown, label, dragging, showClassName = "hidden lg:flex" }: ResizeHandleProps) => (
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label={label}
    title={label}
    onPointerDown={onPointerDown}
    className={cn(
      "group absolute top-0 z-10 h-full w-3 -translate-x-1/2 cursor-col-resize touch-none select-none justify-center",
      side === "right" ? "right-0" : "left-0",
      dragging ? "flex" : showClassName
    )}
  >
    <span className={cn("block h-full w-[2px] rounded-full transition-colors",
      dragging ? "bg-primary" : "bg-transparent group-hover:bg-primary/50")} />
  </div>
);
