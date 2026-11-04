import type { NesboxButton } from "./core-contract";

export const STICK_DEADZONE = 0.28;

// 0°=오른쪽부터 시계 방향(화면 좌표계는 y가 아래로 증가)으로 45°씩 나눈 8방향
const SECTORS: NesboxButton[][] = [
  ["right"],
  ["right", "down"],
  ["down"],
  ["down", "left"],
  ["left"],
  ["left", "up"],
  ["up"],
  ["up", "right"],
];

/**
 * 스틱 중심을 기준으로 방향 버튼을 계산한다. 손가락이 스틱 영역 밖으로 나가도
 * 중심과의 각도로 계속 방향을 정하므로, 끝까지 밀고 있는 동안 입력이 끊기지 않는다.
 */
export function stickButtons(
  x: number,
  y: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
): Set<NesboxButton> {
  const radius = Math.min(rect.width, rect.height) / 2;
  if (radius <= 0) return new Set();
  const dx = (x - (rect.left + rect.width / 2)) / radius;
  const dy = (y - (rect.top + rect.height / 2)) / radius;
  if (Math.hypot(dx, dy) <= STICK_DEADZONE) return new Set();
  const angle = (Math.atan2(dy, dx) + 2 * Math.PI) % (2 * Math.PI);
  const sector = Math.round(angle / (Math.PI / 4)) % SECTORS.length;
  return new Set(SECTORS[sector]);
}
