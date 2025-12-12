import { useEffect, useMemo, useState } from "react";

const clampValue = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const STATIC_UI_OFFSET = 210;
const DEFAULT_VIEWPORT = 720;

const calculateHeights = (viewportHeight: number) => {
  const safeHeight = Math.max(viewportHeight, 0);
  const mainAreaHeight = Math.max(safeHeight - STATIC_UI_OFFSET, 0);

  const timelineTarget = mainAreaHeight * 0.35;
  const timelineHeight = Math.min(
    clampValue(timelineTarget, 180, 320),
    mainAreaHeight
  );

  const remainingHeight = Math.max(mainAreaHeight - timelineHeight, 0);
  const attackCardTarget = remainingHeight * 0.4;
  const attackCardHeight = Math.min(
    clampValue(attackCardTarget, 200, 420),
    remainingHeight
  );

  return {
    viewportHeight: safeHeight,
    mainAreaHeight,
    timelineHeight,
    attackCardHeight,
  };
};

const getViewportHeight = (): number =>
  typeof window === "undefined" ? DEFAULT_VIEWPORT : window.innerHeight;

export const useDynamicLayoutHeights = () => {
  const [viewportHeight, setViewportHeight] = useState(getViewportHeight);

  useEffect(() => {
    const handleResize = () => setViewportHeight(getViewportHeight());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return useMemo(
    () => calculateHeights(viewportHeight),
    [viewportHeight]
  );
};
