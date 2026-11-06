import type { Route } from "./+types/design.arcade-cabinet";
import { ArcadeCabinetPreview } from "../components/ArcadeCabinetPreview";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "NESBOX MAME Grid Card Preview" },
    { name: "description", content: "NESBOX MAME 라이브러리 그리드 카드 디자인 검수 페이지" },
  ];
}

export default function ArcadeCabinetDesign() {
  return (
    <main className="arcade-design-page">
      <header className="arcade-design-page__header">
        <div>
          <span>MAME GRID CARD · DESIGN REVIEW</span>
          <h1>CRT + 컨트롤 패널</h1>
          <p>NES 팩과 같은 그리드 면적에 브라운관과 조이스틱 부분만 남긴 시안입니다.</p>
        </div>
        <a href="/">라이브러리로 돌아가기</a>
      </header>

      <section className="arcade-design-page__notice" aria-label="시안 안내">
        <i aria-hidden />
        <strong>PREVIEW ONLY</strong>
        <span>실제 MAME 카드에는 아직 적용되지 않았습니다.</span>
      </section>

      <section className="arcade-grid-review" aria-labelledby="grid-review-heading">
        <div className="arcade-grid-review__label">
          <span>01</span>
          <h2 id="grid-review-heading">ACTUAL LIBRARY GRID</h2>
          <p>두 카드의 이미지 영역은 모두 1060:704로 동일합니다.</p>
        </div>
        <div className="arcade-grid-review__grid">
          <GridSample system="nes" title="Rockman 4" />
          <GridSample system="mame" title="Street Fighter II" />
          <GridSample system="nes" title="Contra" tone="blue" />
          <GridSample system="mame" title="1942" />
        </div>
      </section>

      <section className="arcade-grid-detail" aria-labelledby="grid-detail-heading">
        <div className="arcade-grid-review__label">
          <span>02</span>
          <h2 id="grid-detail-heading">CARD DETAIL</h2>
          <p>마키와 동전함 없이 CRT와 얕은 6버튼 조작판만 사용합니다.</p>
        </div>
        <div className="arcade-grid-detail__stage">
          <ArcadeCabinetPreview />
          <div className="arcade-grid-detail__notes">
            <p><b>70%</b><span>4:3 CRT 영역</span></p>
            <p><b>30%</b><span>조이스틱 + 6버튼</span></p>
            <p><b>1:1</b><span>NES 팩과 같은 외곽 비율</span></p>
          </div>
        </div>
      </section>
    </main>
  );
}

function GridSample({
  system,
  title,
  tone = "red",
}: {
  system: "nes" | "mame";
  title: string;
  tone?: "red" | "blue";
}) {
  return (
    <article className="arcade-grid-sample">
      {system === "mame" ? <ArcadeCabinetPreview /> : <NesCartridgeSample tone={tone} />}
      <div className="arcade-grid-sample__info">
        <strong>{title}</strong>
        <span>{system === "mame" ? "MAME · 6 BUTTON" : "NES · FCEUX"}</span>
      </div>
    </article>
  );
}

function NesCartridgeSample({ tone }: { tone: "red" | "blue" }) {
  return (
    <div className={`nes-grid-sample nes-grid-sample--${tone}`} aria-label="NES 팩 비교 샘플">
      <div className="nes-grid-sample__body">
        <div className="nes-grid-sample__frame">
          <div className="nes-grid-sample__label">
            <span>FAMILY COMPUTER</span>
            <strong>{tone === "blue" ? "CONTRA" : "ROCKMAN 4"}</strong>
            <small>NESBOX</small>
          </div>
        </div>
      </div>
      <div className="nes-grid-sample__tab" />
    </div>
  );
}
