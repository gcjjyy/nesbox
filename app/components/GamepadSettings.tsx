import { useEffect, useState } from "react";
import { Gamepad2, RotateCcw } from "lucide-react";
import type { NesboxButton } from "../lib/core-contract";
import { controlBindingRows, type ControlProfileId } from "../lib/control-profiles";
import {
  assignGamepadBinding, bindingsForGamepad, createGamepadCapture, gamepadBindingLabel,
  gamepadDeviceKey, readConnectedGamepads, readGamepadButtons, selectGamepad,
  type GamepadDevice,
} from "../lib/gamepad-input";
import type { UserSettings } from "../lib/storage";

export function GamepadSettings({ settings, onChange }: {
  settings: UserSettings;
  onChange: (settings: UserSettings) => void;
}) {
  const [devices, setDevices] = useState<GamepadDevice[]>([]);
  const [error, setError] = useState<"unsupported" | "blocked" | null>(null);
  const [profile, setProfile] = useState<ControlProfileId>("nes");
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState("");
  const [capture, setCapture] = useState<{
    button: NesboxButton;
    key: string;
    index: number;
    read: ReturnType<typeof createGamepadCapture>;
  } | null>(null);
  const device = selectGamepad(devices, settings.gamepad.selectedDevice);

  useEffect(() => {
    let raf = 0;
    function poll() {
      const result = readConnectedGamepads();
      setError(result.error);
      setDevices((previous) => deviceListKey(previous) === deviceListKey(result.devices) ? previous : result.devices);
      const current = selectGamepad(result.devices, settings.gamepad.selectedDevice);
      const canRead = !document.hidden && document.hasFocus();
      const pressed = current && canRead ? readGamepadButtons(current, profile, settings.gamepad) : new Set<NesboxButton>();
      setActive(controlBindingRows(profile).filter(({ button }) => pressed.has(button)).map(({ label }) => label).join(" · "));
      if (capture) {
        if (!current || gamepadDeviceKey(current) !== capture.key || current.index !== capture.index) {
          setCapture(null);
        } else if (canRead) {
          const binding = capture.read(current);
          if (binding) {
            onChange({ ...settings, gamepad: assignGamepadBinding(settings.gamepad, current, profile, capture.button, binding) });
            setCapture(null);
            return;
          }
        }
      }
      raf = requestAnimationFrame(poll);
    }
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [capture, onChange, profile, settings]);

  useEffect(() => {
    if (!capture) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setCapture(null);
    };
    window.addEventListener("keydown", cancel, true);
    return () => window.removeEventListener("keydown", cancel, true);
  }, [capture]);

  function startCapture(button: NesboxButton) {
    const current = selectGamepad(readConnectedGamepads().devices, settings.gamepad.selectedDevice);
    if (current) setCapture({ button, key: gamepadDeviceKey(current), index: current.index, read: createGamepadCapture(current) });
  }

  function reset() {
    if (!device) return;
    const key = gamepadDeviceKey(device);
    const profiles = { ...settings.gamepad.devices[key] };
    delete profiles[profile];
    onChange({ ...settings, gamepad: { ...settings.gamepad, devices: { ...settings.gamepad.devices, [key]: profiles } } });
    setCapture(null);
  }

  const title = profile === "nes" ? "NES" : "MAME";
  const bindings = device ? bindingsForGamepad(device, profile, settings.gamepad) : {};
  const uniqueDevices = [...new Map(devices.map((item) => [gamepadDeviceKey(item), item])).values()];
  return (
    <div className="keyboard-settings gamepad-settings">
      <div className="keyboard-settings__heading">
        <span><Gamepad2 size={16} strokeWidth={1.9} aria-hidden />조이스틱 / 게임패드</span>
        <small>USB 또는 Bluetooth로 연결한 뒤 조이스틱 버튼을 한 번 누르세요. 방향패드와 스틱을 사용할 수 있습니다.</small>
      </div>
      <p className="gamepad-settings__status" role="status">
        {error === "unsupported" ? "이 브라우저에서는 조이스틱을 사용할 수 없습니다. HTTPS 또는 localhost에서 지원 브라우저로 접속하세요."
          : error === "blocked" ? "브라우저가 조이스틱 접근을 차단했습니다. 사이트 접근 권한을 확인하세요."
          : device ? `연결됨: ${device.id}` : "조이스틱 연결 대기 중"}
      </p>
      {(devices.length > 0 || settings.gamepad.selectedDevice) && <label className="gamepad-settings__select">
        사용할 조이스틱
        <select value={settings.gamepad.selectedDevice ?? ""} onChange={(event) => {
          setCapture(null);
          onChange({ ...settings, gamepad: { ...settings.gamepad, selectedDevice: event.target.value || null } });
        }}>
          <option value="">자동 선택 (첫 번째 장치)</option>
          {settings.gamepad.selectedDevice && !device && <option value={settings.gamepad.selectedDevice}>저장된 장치 (연결 안 됨)</option>}
          {uniqueDevices.map((item) => <option key={gamepadDeviceKey(item)} value={gamepadDeviceKey(item)}>{item.id}</option>)}
        </select>
      </label>}
      {device && <>
        <p className="gamepad-settings__status">{device.mapping === "standard" ? "표준 버튼 배치" : "범용 장치: 조작이 맞지 않으면 버튼 설정에서 지정하세요."}</p>
        <button type="button" className="keyboard-settings__action" onClick={() => { setEditing(!editing); setCapture(null); }} aria-expanded={editing}>
          {editing ? "조이스틱 설정 접기" : "조이스틱 버튼 설정"}
        </button>
        {editing && <>
          <label className="gamepad-settings__select">
            조이스틱 게임 종류
            <select value={profile} onChange={(event) => { setProfile(event.target.value as ControlProfileId); setCapture(null); }}>
              <option value="nes">NES</option>
              <option value="mame">MAME (6버튼)</option>
            </select>
          </label>
          <p className="gamepad-settings__status">스틱과 버튼에서 손을 뗀 상태로 바꿀 동작을 누른 뒤, 버튼을 누르거나 스틱을 해당 방향으로 움직이세요. 장치·게임 종류별로 자동 저장됩니다. 같은 입력을 다시 지정하면 이전 동작에서 해제됩니다.</p>
          <fieldset className="key-profile">
            <legend>{title} 조이스틱</legend>
            <div className="key-profile__grid">
              {controlBindingRows(profile).map(({ button, label }) => <div className="key-binding-row" key={button}>
                <span>{label}</span>
                <button type="button" className={`key-binding-button${capture?.button === button ? " key-binding-button--capturing" : ""}`}
                  aria-label={`${title} ${label} 조이스틱 설정`} aria-pressed={capture?.button === button} onClick={() => startCapture(button)}>
                  {capture?.button === button ? "조이스틱을 조작하세요…" : bindings[button]?.map(gamepadBindingLabel).join(" / ") || "미지정"}
                </button>
              </div>)}
            </div>
            <button type="button" className="key-profile__reset" onClick={reset}><RotateCcw size={14} aria-hidden />조이스틱 기본값 복원</button>
          </fieldset>
          {capture && <button type="button" className="key-profile__reset" onClick={() => setCapture(null)}>입력 취소 (Esc)</button>}
          <p className="gamepad-settings__status" aria-live="polite">입력 확인: {active || "없음"}</p>
        </>}
      </>}
    </div>
  );
}

function deviceListKey(devices: GamepadDevice[]): string {
  return JSON.stringify(devices.map((device) => [device.index, device.id, device.mapping]));
}
