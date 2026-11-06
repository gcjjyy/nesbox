import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { ControlProfileId, KeyboardBindings } from "../lib/control-profiles";
import { KeyboardLayoutPreview } from "./KeyboardLayoutPreview";

const PROFILES: Array<{ id: ControlProfileId; label: string }> = [
  { id: "nes", label: "NES" },
  { id: "mame", label: "MAME" },
];

export function ControlGuideTabs({
  bindings,
  defaultProfile = "nes",
  activeProfile,
  onProfileChange,
  renderPanel,
}: {
  bindings: KeyboardBindings;
  defaultProfile?: ControlProfileId;
  activeProfile?: ControlProfileId;
  onProfileChange?: (profile: ControlProfileId) => void;
  renderPanel?: (profile: ControlProfileId) => ReactNode;
}) {
  const [selected, setSelected] = useState<ControlProfileId>(defaultProfile);
  const active = activeProfile ?? selected;
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const id = useId();
  const activeIndex = PROFILES.findIndex((profile) => profile.id === active);

  function setActive(profile: ControlProfileId) {
    setSelected(profile);
    onProfileChange?.(profile);
  }

  function selectAt(index: number) {
    const wrapped = (index + PROFILES.length) % PROFILES.length;
    setActive(PROFILES[wrapped].id);
    tabsRef.current[wrapped]?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowRight") selectAt(activeIndex + 1);
    else if (event.key === "ArrowLeft") selectAt(activeIndex - 1);
    else if (event.key === "Home") selectAt(0);
    else if (event.key === "End") selectAt(PROFILES.length - 1);
    else return;
    event.preventDefault();
  }

  return (
    <div className="control-guide-tabs">
      <div className="control-guide-tabs__list" role="tablist" aria-label="게임 코어 키보드 안내">
        {PROFILES.map((profile, index) => (
          <button
            key={profile.id}
            ref={(node) => { tabsRef.current[index] = node; }}
            id={`${id}-${profile.id}-tab`}
            type="button"
            role="tab"
            aria-selected={active === profile.id}
            aria-controls={`${id}-${profile.id}-panel`}
            tabIndex={active === profile.id ? 0 : -1}
            onClick={() => setActive(profile.id)}
            onKeyDown={onTabKeyDown}
          >
            {profile.label}
          </button>
        ))}
      </div>
      {PROFILES.map((profile) => active === profile.id && (
        <div
          key={profile.id}
          id={`${id}-${profile.id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${profile.id}-tab`}
          className="control-guide-tabs__panel"
        >
          {renderPanel ? renderPanel(profile.id) : <>
            <KeyboardLayoutPreview profile={profile.id} bindings={bindings} />
            {profile.id === "mame" && <p>Coin과 Start, 6개 액션 버튼을 지원합니다.</p>}
          </>}
        </div>
      ))}
    </div>
  );
}
