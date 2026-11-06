import type { GameLoadProgress } from "../lib/game-load-progress";

export function GameLoadingOverlay({ progress }: { progress: GameLoadProgress }) {
  const { label, percent, detail } = progress;
  return (
    <div className="game-loading">
      <strong role="status">{label}</strong>
      <div
        className={`game-loading__bar${percent === null ? " game-loading__bar--indeterminate" : ""}`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
      >
        <span style={percent === null ? undefined : { width: `${percent}%` }} />
      </div>
      <span className="game-loading__detail">{percent === null ? detail ?? "잠시만 기다려 주세요." : `${percent}%`}</span>
    </div>
  );
}
