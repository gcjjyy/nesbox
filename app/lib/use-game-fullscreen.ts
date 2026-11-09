import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { exitPlayerFullscreen, fullscreenLayout, playerFullscreenElement, requestPlayerFullscreen } from './game-fullscreen';

export function useGameFullscreen(host: RefObject<HTMLElement | null>, game: { width: number; height: number }, touch: boolean) {
  const [active, setActive] = useState(false);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const native = useRef(false);
  const [nativeReady, setNativeReady] = useState(false);
  const generation = useRef(0);
  const locked = useRef(false);
  const layout = fullscreenLayout(viewport.width, viewport.height, game.width, game.height, touch);
  const unlock = useCallback(() => {
    if (locked.current) {
      try { screen.orientation?.unlock?.(); } catch { /* Unsupported browser. */ }
      locked.current = false;
    }
  }, []);
  const exit = useCallback(async () => {
    generation.current++;
    setActive(false);
    unlock();
    if (playerFullscreenElement() === host.current) await exitPlayerFullscreen();
    native.current = false;
    setNativeReady(false);
  }, [host, unlock]);
  const toggle = useCallback(async () => {
    if (active) return exit();
    const node = host.current;
    if (!node) return;
    const attempt = ++generation.current;
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    setActive(true);
    const accepted = await requestPlayerFullscreen(node);
    if (attempt !== generation.current) {
      if (accepted && playerFullscreenElement() === node) await exitPlayerFullscreen();
      return;
    }
    native.current = accepted;
    setNativeReady(accepted);
    // Trigger the orientation effect once native fullscreen is available.
    setViewport({ width: window.innerWidth, height: window.innerHeight });
  }, [active, exit, host]);

  useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    const changed = () => {
      if (native.current && playerFullscreenElement() !== host.current) void exit();
      resize();
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') void exit(); };
    resize();
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.addEventListener('keydown', key);
    document.addEventListener('fullscreenchange', changed);
    document.addEventListener('webkitfullscreenchange', changed);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.removeEventListener('keydown', key);
      document.removeEventListener('fullscreenchange', changed);
      document.removeEventListener('webkitfullscreenchange', changed);
    };
  }, [active, exit, host]);

  useEffect(() => {
    if (!active || !touch || !nativeReady) return;
    const orientation = screen.orientation as ScreenOrientation & { lock?: (direction: string) => Promise<void> };
    if (!orientation?.lock) return;
    let cancelled = false;
    void orientation.lock(layout.orientation).then(() => {
      locked.current = true;
      if (cancelled) unlock();
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [active, touch, layout.orientation, nativeReady, unlock]);

  useEffect(() => {
    const node = host.current;
    return () => {
      generation.current++;
      unlock();
      if (playerFullscreenElement() === node) void exitPlayerFullscreen();
    };
  }, [host, unlock]);

  return { active, layout, toggle, exit };
}
