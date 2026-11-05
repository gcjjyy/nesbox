export function hasTouchSurface(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (navigator.maxTouchPoints > 0) return true;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}
