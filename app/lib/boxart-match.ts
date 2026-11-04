// libretro-thumbnails 박스아트 이름(No-Intro 형식)과 ROM 파일명을 짝짓는다.

const REGION_RANK: Record<string, string[]> = {
  japan: ["Japan", "Japan, USA", "World", "USA", "Europe"],
  usa: ["USA", "Japan, USA", "World", "Europe", "Japan"],
  europe: ["Europe", "World", "USA", "Japan"],
};

function normalize(name: string): string {
  return name
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .replace(/^\d+[._]/, "")
    .replace(/\[[^\]]*\]|\([^)]*\)/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function preferredRegion(fileName: string): keyof typeof REGION_RANK {
  if (/\((U|USA)\)/i.test(fileName)) return "usa";
  if (/\((E|Europe)\)/i.test(fileName)) return "europe";
  return "japan";
}

function groupsOf(name: string): string[] {
  return [...name.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
}

/** 날짜·덤프 태그가 붙은 TOSEC 형식은 제외하고 No-Intro 형식만 쓴다. */
function isNoIntro(name: string): boolean {
  return !/\[|\(\d{4}|\(19xx|\(199x|\(200x/.test(name);
}

export function findBoxart(fileName: string, index: string[]): string | null {
  const key = normalize(fileName);
  if (!key) return null;
  const candidates = index.filter((name) => isNoIntro(name) && normalize(name) === key);
  if (candidates.length === 0) return null;
  const rank = REGION_RANK[preferredRegion(fileName)];
  const score = (name: string) => {
    const [region = "", ...rest] = groupsOf(name);
    const regionScore = rank.indexOf(region);
    // 지역 태그 외 (Virtual Console), (Beta) 등이 붙은 판은 뒤로 미룬다.
    return (regionScore < 0 ? rank.length : regionScore) * 10 + rest.length;
  };
  return [...candidates].sort((a, b) => score(a) - score(b))[0];
}

export function originalTitleOf(boxartName: string): string {
  return boxartName
    .replace(/(\s*\([^)]*\))+\s*$/, "")
    .replace(/ _ /g, " & ")
    .trim();
}

export function boxartUrl(boxartName: string): string {
  return `https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Nintendo_Entertainment_System/master/Named_Boxarts/${encodeURIComponent(boxartName)}.png`;
}
