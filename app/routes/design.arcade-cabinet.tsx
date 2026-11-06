import type { Route } from "./+types/design.arcade-cabinet";
import { ArcadeCabinetPreview } from "../components/ArcadeCabinetPreview";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "NESBOX MAME Cabinet Preview" },
    { name: "description", content: "NESBOX MAME 플레이어 배경 디자인 검수 페이지" },
  ];
}

export default function ArcadeCabinetDesign() {
  return (
    <main className="arcade-design-page">
      <header className="arcade-design-page__header">
        <div>
          <span>MAME PLAYER · DESIGN REVIEW</span>
          <h1>오락실 캐비닛 배경</h1>
          <p>실제 게임과 연결하기 전, 화면과 조작부의 비율을 확인하는 시안입니다.</p>
        </div>
        <a href="/">라이브러리로 돌아가기</a>
      </header>

      <section className="arcade-design-page__notice" aria-label="시안 안내">
        <i aria-hidden />
        <strong>PREVIEW ONLY</strong>
        <span>아직 ROM, 키보드 입력, EmulatorJS와 연결되지 않았습니다.</span>
      </section>

      <section className="arcade-design-stage" aria-label="MAME 캐비닛 시안 무대">
        <div className="arcade-design-stage__wall" aria-hidden />
        <div className="arcade-design-stage__halo" aria-hidden />
        <ArcadeCabinetPreview />
        <div className="arcade-design-stage__floor" aria-hidden />
      </section>

      <section className="arcade-design-notes" aria-label="디자인 구성">
        <article><span>01</span><strong>UPRIGHT SILHOUETTE</strong><p>검은 90년대 업라이트 캐비닛의 좁고 높은 비례</p></article>
        <article><span>02</span><strong>4:3 CRT STAGE</strong><p>실제 게임 캔버스가 들어갈 유리 반사와 스캔라인 화면</p></article>
        <article><span>03</span><strong>6 BUTTON DECK</strong><p>붉은 볼 조이스틱과 2×3 배열의 MAME 기본 조작부</p></article>
      </section>
    </main>
  );
}
