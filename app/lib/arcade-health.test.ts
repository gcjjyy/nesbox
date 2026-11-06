import { afterEach, expect, it, vi } from 'vitest';
import { watchArcadeHealth } from './arcade-health';
afterEach(() => vi.useRealTimers());
it('reports a stalled main loop, distinguishes blocked audio, and stops after disposal', () => {
 vi.useFakeTimers(); const status=vi.fn();
 const sample={frame:2,paused:false,hidden:false,audio:'running'};
 const stop=watchArcadeHealth(()=>sample,status);
 vi.advanceTimersByTime(7000); expect(status).toHaveBeenCalledWith('게임 실행이 멈췄습니다. 라이브러리에서 다시 실행해 주세요.');
 sample.audio='suspended';vi.advanceTimersByTime(1000);expect(status).toHaveBeenLastCalledWith('오디오 재생이 차단되었습니다. 화면의 “탭하여 음소거 해제”를 눌러 주세요.');
 stop();status.mockClear();vi.advanceTimersByTime(10000);expect(status).not.toHaveBeenCalled();
});
it('does not report intentional pauses, background tabs, or progressing frames', () => {
 vi.useFakeTimers();const status=vi.fn();let frame=1;
 const sample={frame,paused:true,hidden:false,audio:'running'};
 const stop=watchArcadeHealth(()=>sample,status);
 vi.advanceTimersByTime(10000);sample.paused=false;sample.hidden=true;vi.advanceTimersByTime(10000);
 sample.hidden=false;for(let i=0;i<10;i++){sample.frame=++frame;vi.advanceTimersByTime(1000);}
 expect(status).not.toHaveBeenCalled();stop();
});
it('reports a lost graphics context and stops polling a terminated WASM runtime', () => {
 vi.useFakeTimers();const status=vi.fn();let terminated=false;
 const stop=watchArcadeHealth(()=>{if(terminated)throw new Error('aborted');return {frame:2,paused:false,hidden:false,audio:'running',graphicsLost:true};},status);
 vi.advanceTimersByTime(1000);expect(status).toHaveBeenLastCalledWith('그래픽 연결이 끊겨 게임이 멈췄습니다. 라이브러리에서 다시 실행해 주세요.');
 terminated=true;vi.advanceTimersByTime(1000);expect(status).toHaveBeenLastCalledWith('게임 실행이 중단되었습니다. 라이브러리에서 다시 실행해 주세요.');
 status.mockClear();vi.advanceTimersByTime(10000);expect(status).not.toHaveBeenCalled();stop();
});
