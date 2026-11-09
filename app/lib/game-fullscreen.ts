export function fullscreenLayout(viewWidth: number, viewHeight: number, gameWidth: number, gameHeight: number, touch: boolean) {
  const orientation = gameWidth >= gameHeight ? 'landscape' : 'portrait';
  const mismatch = (viewWidth >= viewHeight) !== (orientation === 'landscape');
  const rotation = touch && mismatch ? (orientation === 'landscape' ? 90 : -90) : 0;
  return { width: rotation ? viewHeight : viewWidth, height: rotation ? viewWidth : viewHeight, rotation, orientation } as const;
}

type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FullscreenDocument = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> | void };
export function playerFullscreenElement(): Element | null {
  return document.fullscreenElement ?? (document as FullscreenDocument).webkitFullscreenElement ?? null;
}
export async function requestPlayerFullscreen(element: HTMLElement): Promise<boolean> {
  const request = element.requestFullscreen ?? (element as FullscreenElement).webkitRequestFullscreen;
  if (!request) return false;
  try { await request.call(element); return true; } catch { return false; }
}
export async function exitPlayerFullscreen(): Promise<void> {
  const exit = document.exitFullscreen ?? (document as FullscreenDocument).webkitExitFullscreen;
  try { await exit?.call(document); } catch { /* The browser may have already exited. */ }
}

// Safari's visible viewport changes independently of the layout viewport when
// its address bar appears, including during a device rotation.
export function playerViewport() {
  const visual = window.visualViewport;
  return {
    width: visual?.width || window.innerWidth,
    height: visual?.height || window.innerHeight,
    left: visual?.offsetLeft ?? 0,
    top: visual?.offsetTop ?? 0,
  };
}
