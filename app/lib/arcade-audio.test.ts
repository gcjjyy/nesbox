import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareArcadeAudio, takeArcadeAudio } from './arcade-audio';
function context() { return { state: 'suspended', resume: vi.fn(async () => {}), close: vi.fn(async () => {}) } as unknown as AudioContext; }
afterEach(() => vi.unstubAllGlobals());
describe('arcade audio user activation', () => {
  it('resumes synchronously in the launch click and hands that same context to the delayed runtime', () => {
    const audio = context(); vi.stubGlobal('AudioContext', vi.fn(function () { return audio; }));
    prepareArcadeAudio();
    expect(audio.resume).toHaveBeenCalledTimes(1);
    expect(takeArcadeAudio()).toBe(audio);
  });
  it('closes an unused reservation and creates fresh audio for a direct play URL', () => {
    const first = context(), second = context();
    vi.stubGlobal('AudioContext', vi.fn().mockImplementationOnce(function () { return first; }).mockImplementation(function () { return second; }));
    prepareArcadeAudio(); prepareArcadeAudio();
    expect(first.close).toHaveBeenCalledOnce();
    expect(takeArcadeAudio()).toBe(second);
    expect(takeArcadeAudio()).toBe(second);
  });
});
