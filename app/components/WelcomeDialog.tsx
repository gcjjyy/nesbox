import { useEffect, useState } from "react";
import { Gamepad2, Keyboard, Save, Smartphone, Volume2 } from "lucide-react";
import { markWelcomed, needsWelcome } from "../lib/first-visit";
import { KEYBOARD_LAYOUTS, type KeyboardLayoutId } from "../lib/keyboard-layout";
import type { UserSettings } from "../lib/storage";
import { hasTouchSurface } from "../lib/touch-surface";
import { SITE_NAME } from "../lib/site-metadata";
import { KeyboardLayoutPreview } from "./KeyboardLayoutPreview";

const ICON = { size: 16, strokeWidth: 1.9, "aria-hidden": true } as const;

export interface WelcomeDialogProps {
  settings: UserSettings;
  onChange: (settings: UserSettings) => void;
}

function browserStorage() {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** 첫 방문에만 뜨는 안내. 데스크톱은 키 배치를 고르게 하고, 모바일은 터치 조작을 알려 준다. */
export function WelcomeDialog({ settings, onChange }: WelcomeDialogProps) {
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
          <p>{mode === "desktop" ? "시작하기 전에 키 배치를 골라 주세요" : "터치로 바로 플레이할 수 있어요"}</p>
        </header>

        {mode === "desktop" ? (
          <>
            <ul className="welcome-dialog__tips">
              <li>
                <Gamepad2 {...ICON} />
                라이브러리에서 카트리지를 고르면 바로 시작돼요. 게임패드도 꽂으면 자동 인식.
              </li>
              <li>
                <Save {...ICON} />
                플레이 화면의 버튼으로 상태 저장 / 불러오기, 리셋, 전체 화면을 쓸 수 있어요.
              </li>
              <li>
                <Keyboard {...ICON} />
                키 배치와 볼륨은 언제든 설정에서 바꿀 수 있어요.
              </li>
            </ul>
            <div className="key-layout-options" role="radiogroup" aria-label="PC 키 배치">
              {(Object.keys(KEYBOARD_LAYOUTS) as KeyboardLayoutId[]).map((id) => (
                <label key={id} className="key-layout-option">
                  <input
                    type="radio"
                    name="welcome-keyboard-layout"
                    value={id}
                    checked={settings.keyboardLayout === id}
                    onChange={() => onChange({ ...settings, keyboardLayout: id })}
                  />
                  <span className="key-layout-option__name">{KEYBOARD_LAYOUTS[id].name}</span>
                  <KeyboardLayoutPreview layoutId={id} />
                </label>
              ))}
            </div>
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
