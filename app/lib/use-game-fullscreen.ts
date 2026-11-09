import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { exitPlayerFullscreen, fullscreenLayout, playerFullscreenElement, playerViewport, requestPlayerFullscreen } from './game-fullscreen';

export function useGameFullscreen(host: RefObject<HTMLElement | null>, game: { width: number; height: number }, touch: boolean) {
  const [active, setActive] = useState(false);
  const [viewport, setViewport] = useState({ width: 1, height: 1, left: 0, top: 0 });
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
    setViewport(playerViewport());
    setActive(true);
    const accepted = await requestPlayerFullscreen(node);
    if (attempt !== generation.current) {
      if (accepted && playerFullscreenElement() === node) await exitPlayerFullscreen();
      return;
    }
    native.current = accepted;
    setNativeReady(accepted);
    // Trigger the orientation effect once native fullscreen is available.
    setViewport(playerViewport());
  }, [active, exit, host]);

  useEffect(() => {
    if (!active) return;
    const scrollRoots = [document.documentElement, document.body];
    const previousOverflow = scrollRoots.map((element) => element.style.overflow);
    scrollRoots.forEach((element) => { element.style.overflow = 'hidden'; });
    const resize = () => setViewport(playerViewport());
    const changed = () => {
      if (native.current && playerFullscreenElement() !== host.current) {
        native.current = false;
        setNativeReady(false);
        unlock();
        // Mobile browsers can drop native fullscreen on rotation. Keep the page
        // player open; the exit button/Escape still explicitly leaves this mode.
        if (!touch) void exit();
      }
      resize();
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') void exit(); };
    resize();
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    window.addEventListener('orientationchange', resize);
    screen.orientation?.addEventListener('change', resize);
    window.addEventListener('keydown', key);
    document.addEventListener('fullscreenchange', changed);
    document.addEventListener('webkitfullscreenchange', changed);
    return () => {
      scrollRoots.forEach((element, index) => { element.style.overflow = previousOverflow[index]; });
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
      window.removeEventListener('orientationchange', resize);
      screen.orientation?.removeEventListener('change', resize);
      window.removeEventListener('keydown', key);
      document.removeEventListener('fullscreenchange', changed);
      document.removeEventListener('webkitfullscreenchange', changed);
    };
  }, [active, exit, host, touch, unlock]);

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

  return { active, layout, viewport, toggle, exit };
}
