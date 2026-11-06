import { useEffect, useState } from "react";
import { Gamepad2, Save, Smartphone, Volume2 } from "lucide-react";
import { markWelcomed, needsWelcome } from "../lib/first-visit";
import type { KeyboardBindings } from "../lib/control-profiles";
import { hasTouchSurface } from "../lib/touch-surface";
import { SITE_NAME } from "../lib/site-metadata";
import { ControlGuideTabs } from "./ControlGuideTabs";

const ICON = { size: 16, strokeWidth: 1.9, "aria-hidden": true } as const;

function browserStorage() {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** 첫 방문에만 뜨는 안내. 데스크톱은 키보드 조작을, 모바일은 터치 조작을 알려 준다. */
export function WelcomeDialog({ bindings }: { bindings: KeyboardBindings }) {
  const [mode, setMode] = useState<"desktop" | "mobile" | null>(null);

  useEffect(() => {
    // SSR 결과와 어긋나지 않도록 마운트 후에 판단한다.
    if (needsWelcome(browserStorage())) setMode(hasTouchSurface() ? "mobile" : "desktop");
  }, []);

  if (!mode) return null;

  const close = () => {
    markWelcomed(browserStorage());
    setMode(null);
  };

  return (
    <div className="sheet-backdrop" role="presentation">
      <section className="welcome-dialog" role="dialog" aria-modal="true" aria-label="처음 오셨네요">
        <header>
          <h2>{SITE_NAME}에 오신 걸 환영해요</h2>
          <p>{mode === "desktop" ? "키보드로 바로 플레이할 수 있어요" : "터치로 바로 플레이할 수 있어요"}</p>
        </header>

        {mode === "desktop" ? (
          <>
            <ul className="welcome-dialog__tips">
              <li>
                <Gamepad2 {...ICON} />
                라이브러리에서 카트리지를 고르면 바로 시작돼요.
              </li>
              <li>
                <Save {...ICON} />
                플레이 화면의 버튼으로 상태 저장 / 불러오기, 리셋, 전체 화면을 쓸 수 있어요.
              </li>
            </ul>
            <ControlGuideTabs bindings={bindings} />
          </>
        ) : (
          <ul className="welcome-dialog__tips">
            <li>
              <Gamepad2 {...ICON} />
              라이브러리에서 카트리지를 탭하면 바로 시작돼요.
            </li>
            <li>
              <Smartphone {...ICON} />
              왼쪽 스틱을 드래그해 이동, 오른쪽 B / A 버튼으로 액션. A+B 버튼은 두 버튼을 동시에 눌러요.
            </li>
            <li>
              <Gamepad2 {...ICON} />
              MAME은 Coin / Start와 1–6의 6버튼 배열을 사용해요.
            </li>
            <li>
              <Save {...ICON} />
              가운데 버튼으로 일시정지, 리셋, 상태 저장 / 불러오기.
            </li>
            <li>
              <Volume2 {...ICON} />
              소리가 안 나면 화면의 “탭하여 음소거 해제”를 눌러 주세요. 터치 버튼은 설정에서 끌 수 있어요.
            </li>
          </ul>
        )}

        <footer>
          <button type="button" className="welcome-dialog__start" onClick={close}>
            시작하기
          </button>
        </footer>
      </section>
    </div>
  );
}
