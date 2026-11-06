export interface ArcadeHealthSample {
  frame: number | undefined;
  paused: boolean;
  hidden: boolean;
  audio: string | undefined;
  graphicsLost?: boolean;
}

/** A runtime's start callback alone does not prove its frame loop is still running. */
export function watchArcadeHealth(sample: () => ArcadeHealthSample, report: (message: string) => void): () => void {
  let previous: number | undefined;
  let stalled = 0;
  let lastMessage = '';
  const timer = setInterval(() => {
    let state: ArcadeHealthSample;
    try { state = sample(); } catch {
      report('게임 실행이 중단되었습니다. 라이브러리에서 다시 실행해 주세요.');
      clearInterval(timer);
      return;
    }
    if (state.paused || state.hidden || state.frame === undefined) {
      stalled = 0;
      previous = undefined;
      return;
    }
    stalled = state.frame === previous ? stalled + 1 : 0;
    previous = state.frame;
    const message = state.graphicsLost
      ? '그래픽 연결이 끊겨 게임이 멈췄습니다. 라이브러리에서 다시 실행해 주세요.'
      : state.audio && state.audio !== 'running' && state.audio !== 'closed'
      ? '오디오 재생이 차단되었습니다. 화면의 “탭하여 음소거 해제”를 눌러 주세요.'
      : stalled >= 5 ? '게임 실행이 멈췄습니다. 라이브러리에서 다시 실행해 주세요.' : '';
    if (message && message !== lastMessage) report(message);
    else if (!message && lastMessage) report('실행 중');
    lastMessage = message;
  }, 1000);
  return () => clearInterval(timer);
}
