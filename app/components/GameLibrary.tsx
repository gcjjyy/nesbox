import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, ChevronDown, Clock, Database, LayoutGrid, Play, Plus, Search } from "lucide-react";
import { arrangeGames, CATALOG_SORTS, isKoreanEdition, type CatalogSort } from "../lib/catalog";
import { emulatorById } from "../lib/emulator-registry";
import { coverUrl } from "../lib/library-client";
import { formatBytes } from "../lib/rom";
import type { GameEntry } from "../lib/game-types";
import {
  COPYRIGHT_TEXT,
  DOS_MUSEUM_URL,
  SITE_BRAND_PREFIX,
  SITE_BRAND_PRODUCT,
} from "../lib/site-metadata";

export interface GameLibraryProps {
  games: GameEntry[];
  recent: { game: GameEntry; playedAt: number }[];
  importing: boolean;
  status: string;
  onAdd: () => void;
  onImportOpenEmu: () => void;
  onLaunch: (gameId: string) => void;
}

type Tab = "all" | "recent";

const ICON = { size: 16, strokeWidth: 1.9, "aria-hidden": true } as const;
const SMALL_ICON = { size: 14, strokeWidth: 2, "aria-hidden": true } as const;

export function GameLibrary({ games, recent, importing, status, onAdd, onImportOpenEmu, onLaunch }: GameLibraryProps) {
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<CatalogSort>("title");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    if (tab === "all") return arrangeGames(games, sort, query).map((game) => ({ game, playedAt: null }));
    const matches = new Set(arrangeGames(recent.map((entry) => entry.game), "title", query).map((game) => game.id));
    return recent.filter((entry) => matches.has(entry.game.id));
  }, [tab, games, recent, sort, query]);

  return (
    <section className="game-library" aria-label="게임 라이브러리">
      <header className="game-library__header">
        <div className="game-library__heading">
          <h1>Game Library</h1>
          <p>{games.length} games · {status}</p>
        </div>
        <div className="game-library__buttons">
          <button type="button" className="library-add" onClick={onImportOpenEmu} disabled={importing}>
            <Database {...ICON} />
            OpenEmu
          </button>
          <button type="button" className="library-add" onClick={onAdd}>
            <Plus {...ICON} />
            Add
          </button>
        </div>
      </header>

      <div className="catalog-bar">
        <div className="catalog-tabs" role="tablist" aria-label="보기">
          <button type="button" role="tab" aria-selected={tab === "all"} onClick={() => setTab("all")}>
            <LayoutGrid {...SMALL_ICON} />
            전체 게임
            <span>{games.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === "recent"} onClick={() => setTab("recent")}>
            <Clock {...SMALL_ICON} />
            최근 플레이
            <span>{recent.length}</span>
          </button>
        </div>
        <div className="catalog-tools">
          <label className="catalog-search">
            <Search {...SMALL_ICON} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="제목 검색"
              aria-label="제목 검색"
            />
          </label>
          {tab === "all" ? (
            <SortMenu value={sort} onChange={setSort} />
          ) : (
            <span className="catalog-hint">이 브라우저에서 플레이한 순서</span>
          )}
        </div>
      </div>

      <div className="catalog-scroll">
        {visible.length === 0 ? (
          <div className="library-empty">
            {tab === "recent" && !query ? (
              <>
                <strong>아직 플레이한 게임이 없어요</strong>
                <span>게임을 실행하면 이 브라우저에 기록되어 여기에 표시됩니다.</span>
              </>
            ) : games.length === 0 ? (
              <>
                <strong>No games</strong>
                <span>OpenEmu에서 가져오거나 ROM을 추가하면 SQLite 라이브러리에 저장됩니다.</span>
              </>
            ) : (
              <strong>검색 결과가 없습니다.</strong>
            )}
          </div>
        ) : (
          <ul className="catalog-grid">
            {visible.map(({ game, playedAt }) => (
              <li key={game.id}>
                <GameCard game={game} playedAt={playedAt} onLaunch={onLaunch} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="game-library__footer">
        <span>{COPYRIGHT_TEXT}</span>
        <span aria-hidden>·</span>
        <a href={DOS_MUSEUM_URL} target="_blank" rel="noopener noreferrer">
          {SITE_BRAND_PREFIX}
        </a>
        <span>{SITE_BRAND_PRODUCT}</span>
      </footer>
    </section>
  );
}

// 실제 패미컴 팩에서 볼 수 있는 셸 색상들
const SHELL_COLORS = [
  "#c4201f", "#e8c31e", "#2a5fb8", "#2f8f4e", "#202124", "#e6e1d3",
  "#e3711f", "#6a3fa0", "#e36a9a", "#8a8d90", "#2aa7c4", "#8a5a35",
];

function shellColorFor(gameId: string): string {
  let hash = 0;
  for (const ch of gameId) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) >>> 0;
  return SHELL_COLORS[hash % SHELL_COLORS.length];
}

function GameCard({ game, playedAt, onLaunch }: { game: GameEntry; playedAt: number | null; onLaunch: (gameId: string) => void }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const artRef = useRef<HTMLImageElement | null>(null);
  const emulator = emulatorById(game.emulatorId);
  const showCover = game.hasCover && !coverFailed;
  const src = coverUrl(game.id);

  // 하이드레이션 전에 이미 로드된 이미지는 onLoad가 오지 않으므로 마운트 시점에도 확인한다.
  useEffect(() => {
    const img = artRef.current;
    if (img?.complete && img.naturalWidth > 0) setPortrait(img.naturalHeight > img.naturalWidth);
  }, []);

  return (
    <button
      type="button"
      className="cart"
      style={{ "--shell": shellColorFor(game.id) } as CSSProperties}
      onClick={() => onLaunch(game.id)}
      aria-label={`${game.title} 실행`}
    >
      <span className="cart__shape" aria-hidden>
        <span className="cart__body">
          <span className="cart__frame">
            <span className="cart__label">
              {showCover ? (
                <img
                  ref={artRef}
                  className={portrait ? "cart__label-art cart__label-art--portrait" : "cart__label-art"}
                  src={src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onLoad={(event) => setPortrait(event.currentTarget.naturalHeight > event.currentTarget.naturalWidth)}
                  onError={() => setCoverFailed(true)}
                />
              ) : (
                <GeneratedLabel title={game.title} />
              )}
              <span className="cart__play">
                <Play size={26} fill="currentColor" />
              </span>
            </span>
          </span>
        </span>
        <span className="cart__tab" />
      </span>
      <span className="cart__info">
        <strong title={game.title}>{game.title}</strong>
        {game.originalTitle && <small title={game.originalTitle}>{game.originalTitle}</small>}
        <span className="cart__meta">
          {isKoreanEdition(game.title) && <span className="cart__korean">한글</span>}
          <span>{game.system.toUpperCase()}</span>
          <span>{emulator?.shortName ?? game.emulatorId}</span>
          <span>{formatBytes(game.size)}</span>
        </span>
        {playedAt !== null && <span className="cart__played">{formatPlayedAt(playedAt)}</span>}
      </span>
    </button>
  );
}

/** 박스아트가 없는 게임용 라벨: 초기 패미컴 은색 라벨 스타일 */
function GeneratedLabel({ title }: { title: string }) {
  const code = title.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "XX";
  return (
    <span className="generated-label">
      <span className="generated-label__code">HVC-{code}</span>
      <span className="generated-label__fc">FAMILY COMPUTER</span>
      <strong className="generated-label__title">{title}</strong>
      <svg className="generated-label__chevron" viewBox="0 0 200 100" preserveAspectRatio="none">
        <path d="M0 52 H118 L150 82 L200 30 V12 L150 64 L126 40 H0 Z" />
        <path d="M0 70 H112 L150 100 M0 76 H110 L150 108 M0 82 H108 L150 116" fill="none" strokeWidth="1.6" />
      </svg>
      <span className="generated-label__foot">NESBOX</span>
    </span>
  );
}

function SortMenu({ value, onChange }: { value: CatalogSort; onChange: (next: CatalogSort) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="sort-menu" ref={ref}>
      <button
        type="button"
        className="sort-menu__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="정렬"
        onClick={() => setOpen(!open)}
      >
        {CATALOG_SORTS.find((option) => option.value === value)?.label}
        <ChevronDown {...SMALL_ICON} />
      </button>
      {open && (
        <ul className="sort-menu__list" role="listbox" aria-label="정렬">
          {CATALOG_SORTS.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <Check {...SMALL_ICON} style={{ opacity: option.value === value ? 1 : 0 }} />
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const RELATIVE_TIME = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

function formatPlayedAt(playedAt: number): string {
  const minutes = Math.round((playedAt - Date.now()) / 60_000);
  if (Math.abs(minutes) < 1) return "방금 플레이";
  if (Math.abs(minutes) < 60) return `${RELATIVE_TIME.format(minutes, "minute")} 플레이`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${RELATIVE_TIME.format(hours, "hour")} 플레이`;
  return `${RELATIVE_TIME.format(Math.round(hours / 24), "day")} 플레이`;
}
