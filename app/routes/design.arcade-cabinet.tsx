import type { Route } from "./+types/design.arcade-cabinet";
import { ArcadeCabinetPreview } from "../components/ArcadeCabinetPreview";
import { GameCard } from "../components/GameLibrary";
import { coverUrl } from "../lib/library-client";
import type { GameEntry } from "../lib/game-types";

export function meta() {
  return [{ title: "NESBOX — Arcade card preview" }];
}

export async function loader() {
  const { listGames } = await import("../lib/library.server");
  const games = listGames();
  const nes = games.filter(g => g.system === "nes" && g.hasCover);
  const arcade = ["sf2ce", "mslug", "1942", "contra"]
    .map(name => games.find(g => g.system === "arcade" && g.originalTitle === name && g.hasCover))
    .filter((g): g is GameEntry => Boolean(g));
  const rockman = nes.find(g => g.title.includes("ROCKMAN4")) ?? nes[0];
  const second = nes.find(g => g.title.includes("ROCKMAN5")) ?? nes.find(g => g.id !== rockman?.id);
  return { nes: [rockman, second].filter((g): g is GameEntry => Boolean(g)), arcade };
}

export default function ArcadeCabinetDesign({ loaderData }: Route.ComponentProps) {
  const { nes, arcade } = loaderData;
  return (
    <main className="arcade-design-page">
      <header className="arcade-review-header">
        <a href="/">← NESBOX</a>
        <span>DESIGN PREVIEW / 03</span>
      </header>
      <section className="arcade-review-intro">
        <span className="arcade-review-eyebrow">THE ARCADE COLLECTION</span>
        <h1>오락실을 한 칸에.</h1>
        <p>브라운관, 조이스틱, 여섯 개의 버튼.<br/>NES 팩 옆에 놓일 작은 오락기입니다.</p>
      </section>
      <section className="arcade-review-hero" aria-label="MAME 카드 확대 보기">
        <div className="arcade-review-hero__card">
          <ArcadeCabinetPreview cover={arcade[0] ? coverUrl(arcade[0].id) : undefined} title={arcade[0]?.title}/>
        </div>
        <span>CRT & CONTROL DECK</span>
      </section>
      <section className="arcade-review-library" aria-labelledby="comparison-title">
        <header><h2 id="comparison-title">라이브러리에 놓으면</h2><span>실제 NES 팩 · 같은 카드 비율</span></header>
        <ul className="catalog-grid">
          {nes[0] && <li><GameCard game={nes[0]} playedAt={null} onLaunch={() => undefined}/></li>}
          {arcade[0] && <li><ArcadeSample game={arcade[0]}/></li>}
          {nes[1] && <li><GameCard game={nes[1]} playedAt={null} onLaunch={() => undefined}/></li>}
          {arcade[1] && <li><ArcadeSample game={arcade[1]}/></li>}
        </ul>
      </section>
      <section className="arcade-review-library arcade-review-library--variants" aria-labelledby="screens-title">
        <header><h2 id="screens-title">게임 화면을 담은 모습</h2><span>가로 · 세로 화면</span></header>
        <ul className="catalog-grid">
          {arcade.map(game => <li key={game.id}><ArcadeSample game={game}/></li>)}
        </ul>
      </section>
      <footer className="arcade-review-footer">검수용 시안입니다. 실제 게임 목록에는 아직 적용하지 않았습니다.</footer>
    </main>
  );
}

function ArcadeSample({ game }: { game: GameEntry }) {
  return (
    <article className="cart arcade-review-card">
      <ArcadeCabinetPreview cover={coverUrl(game.id)} title={game.title}/>
      <div className="cart__info">
        <strong>{game.title}</strong>
        <small>{game.originalTitle}</small>
        <span className="cart__meta"><span className="cart__category">MAME</span><span>{game.emulatorId === "fbneo" ? "FBNeo" : "MAME 2003+"}</span></span>
      </div>
    </article>
  );
}
