import {
  controlGuideRows,
  type ControlGuideRow,
  type ControlProfileId,
  type KeyboardBindings,
} from "../lib/control-profiles";

function Keycap({ label, action, wide }: { label: string; action: string; wide?: boolean }) {
  return (
    <span className={`keycap${wide ? " keycap--wide" : ""}`}>
      <kbd>{label}</kbd>
      <small>{action}</small>
    </span>
  );
}

export function KeyboardLayoutPreview({
  profile,
  bindings,
}: {
  profile: ControlProfileId;
  bindings: KeyboardBindings;
}) {
  const rows = controlGuideRows(profile, bindings);
  const directions = rows[0];
  const system = rows.slice(1, 3);
  const face = rows.slice(3);
  const directionOrder = [0, 2, 1, 3];

  return (
    <div className={`keymap keymap--${profile}`} aria-label={`${profile === "mame" ? "MAME" : "NES"} PC 키 배치`}>
      <div className="keymap__dpad">
        {directionOrder.map((index) => (
          <Keycap key={`${directions.id}-${index}`} label={directions.keys[index]} action={directions.label} />
        ))}
      </div>
      <div className="keymap__system">
        {system.map((row) => <GuideKeycap key={row.id} row={row} wide />)}
      </div>
      <div className="keymap__face">
        {face.map((row) => <GuideKeycap key={row.id} row={row} />)}
      </div>
    </div>
  );
}

function GuideKeycap({ row, wide }: { row: ControlGuideRow; wide?: boolean }) {
  const labels = [...new Set(row.keys)];
  const label = labels.join("/");
  return <Keycap label={label} action={row.label} wide={wide || label.length > 3} />;
}
