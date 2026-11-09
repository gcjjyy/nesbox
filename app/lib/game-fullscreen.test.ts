import { expect, it, vi } from 'vitest';
import { fullscreenLayout, playerViewport, requestPlayerFullscreen } from './game-fullscreen';
import { stickButtons } from './touch-stick';
it('fits landscape and portrait games with rotation only on a mismatched touch screen', () => {
 expect(fullscreenLayout(390,844,384,224,true)).toEqual({width:844,height:390,rotation:90,orientation:'landscape'});
 expect(fullscreenLayout(844,390,224,288,true)).toEqual({width:390,height:844,rotation:-90,orientation:'portrait'});
 expect(fullscreenLayout(390,844,224,288,true).rotation).toBe(0);
 expect(fullscreenLayout(1280,720,224,288,false).rotation).toBe(0);
});
it('falls back when native fullscreen is unavailable or rejected', async () => {
 await expect(requestPlayerFullscreen({} as HTMLElement)).resolves.toBe(false);
 await expect(requestPlayerFullscreen({requestFullscreen:vi.fn().mockRejectedValue(new Error('denied'))} as unknown as HTMLElement)).resolves.toBe(false);
 const requestFullscreen=vi.fn().mockResolvedValue(undefined);
 await expect(requestPlayerFullscreen({requestFullscreen} as unknown as HTMLElement)).resolves.toBe(true);
 expect(requestFullscreen).toHaveBeenCalledOnce();
});
it('keeps joystick directions relative to the rotated game', () => {
 const rect={left:0,top:0,width:100,height:100};
 expect([...stickButtons(50,95,rect,90)]).toEqual(['right']);
 expect([...stickButtons(95,50,rect,90)]).toEqual(['up']);
 expect([...stickButtons(50,5,rect,-90)]).toEqual(['right']);
});

it('fits the visible Safari viewport when browser chrome reduces its height', () => {
  vi.stubGlobal('window', {
    innerWidth: 844, innerHeight: 390,
    visualViewport: { width: 844, height: 320, offsetLeft: 0, offsetTop: 12 },
  });
  try {
    expect(playerViewport()).toEqual({ width: 844, height: 320, left: 0, top: 12 });
  } finally { vi.unstubAllGlobals(); }
});
it('uses the window dimensions when VisualViewport is unavailable', () => {
  vi.stubGlobal('window', { innerWidth: 390, innerHeight: 844 });
  try {
    expect(playerViewport()).toEqual({ width: 390, height: 844, left: 0, top: 0 });
  } finally { vi.unstubAllGlobals(); }
});
