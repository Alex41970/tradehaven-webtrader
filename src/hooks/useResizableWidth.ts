import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A panel width the trader can drag and have remembered between visits.
 * Widths are clamped so a panel can never be dragged shut or hog the whole screen.
 */
export function useResizableWidth(key: string, fallback: number, min: number, max: number) {
  const storageKey = `th-panel-${key}`;
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return fallback;
    const saved = Number(window.localStorage.getItem(storageKey));
    return Number.isFinite(saved) && saved > 0 ? Math.min(max, Math.max(min, saved)) : fallback;
  });
  const [dragging, setDragging] = useState(false);
  const widthRef = useRef(width);
  const minRef = useRef(min);
  const maxRef = useRef(max);

  useEffect(() => { widthRef.current = width; }, [width]);
  useEffect(() => { minRef.current = min; maxRef.current = max; }, [min, max]);

  /** dir = 1 when dragging right makes the panel wider, -1 for a panel on the right edge. */
  const startDrag = useCallback((event: React.PointerEvent, dir: 1 | -1) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    setDragging(true);

    const onMove = (e: PointerEvent) => {
      const next = Math.min(maxRef.current, Math.max(minRef.current, startWidth + dir * (e.clientX - startX)));
      widthRef.current = next;
      setWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragging(false);
      try { window.localStorage.setItem(storageKey, String(widthRef.current)); } catch { /* storage off */ }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [storageKey]);

  return { width, startDrag, dragging };
}
