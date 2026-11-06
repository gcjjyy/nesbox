import { Link } from "react-router";
import type { Route } from "./+types/design.nesbox-logo";
import { NesboxWordmark } from "../components/NesboxWordmark";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "NESBOX Logo Concept" },
    { name: "description", content: "NESBOX 타이포그래피 로고 디자인 검수 페이지" },
  ];
}

export default function NesboxLogoDesign() {
  return (
    <main className="logo-design-page">
      <header className="logo-design-page__header">
        <div>
          <span className="logo-design-page__eyebrow">DESIGN REVIEW · CONCEPT 01</span>
          <h1>NESBOX 워드마크</h1>
          <p>라이브 화면에는 아직 적용하지 않은 검수용 타이포그래피 시안입니다.</p>
        </div>
        <Link to="/">라이브러리로 돌아가기</Link>
      </header>

      <section className="logo-design-hero" aria-labelledby="logo-primary-heading">
        <div className="logo-design-section-label">
          <span>01</span>
          <h2 id="logo-primary-heading">Primary wordmark</h2>
        </div>
        <div className="logo-design-hero__stage">
          <span className="logo-design-hero__glow" aria-hidden />
          <NesboxWordmark />
          <p>BROWSER ARCADE SYSTEM</p>
        </div>
        <p className="logo-design-hero__caption">
          직선적인 NES 글자와 전면 패널처럼 단단한 BOX 글자를 연결했습니다.
          붉은 신호선은 카트리지에서 화면으로 이어지는 플레이 신호를 뜻합니다.
        </p>
      </section>

      <section className="logo-design-context" aria-labelledby="logo-context-heading">
        <div className="logo-design-section-label">
          <span>02</span>
          <h2 id="logo-context-heading">Header scale</h2>
        </div>
        <div className="logo-design-context__bar">
          <NesboxWordmark />
          <div className="logo-design-context__status">
            <i aria-hidden />
            <span>460 GAMES ONLINE</span>
          </div>
        </div>
        <p>실제 라이브러리 헤더에 들어갔을 때의 크기와 명암을 확인하는 예시입니다.</p>
      </section>

      <section className="logo-design-variants" aria-labelledby="logo-variants-heading">
        <div className="logo-design-section-label">
          <span>03</span>
          <h2 id="logo-variants-heading">One-color use</h2>
        </div>
        <div className="logo-design-variants__grid">
          <div className="logo-design-variant logo-design-variant--dark">
            <span>DARK / CREAM</span>
            <NesboxWordmark className="nesbox-wordmark--mono" />
          </div>
          <div className="logo-design-variant logo-design-variant--light">
            <span>LIGHT / INK</span>
            <NesboxWordmark className="nesbox-wordmark--mono" />
          </div>
        </div>
      </section>
    </main>
  );
}
