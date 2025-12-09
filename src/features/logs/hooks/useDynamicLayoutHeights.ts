import { useEffect, useMemo, useState } from "react";

const clampValue = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const STATIC_UI_OFFSET = 210;
const MIN_VIEWPORT = 720;

const calculateHeights = (viewportHeight: number) => {
  const safeHeight = Math.max(viewportHeight, MIN_VIEWPORT);
  const mainAreaHeight = Math.max(safeHeight - STATIC_UI_OFFSET, 520);
  const timelineHeight = clampValue(mainAreaHeight * 0.35, 200, 360);
  const attackCardHeight = clampValue((mainAreaHeight - timelineHeight) * 0.4, 240, 420);

  return {
    viewportHeight: safeHeight,
    mainAreaHeight,
    timelineHeight,
    attackCardHeight,
  };
};

const getViewportHeight = (): number =>
  typeof window === "undefined" ? MIN_VIEWPORT : window.innerHeight;

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
