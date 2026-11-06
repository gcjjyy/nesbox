import type { GameEntry } from "./game-types";

type CardLabelSource = Pick<GameEntry, "system" | "title" | "fileName" | "originalTitle">;

export interface LibraryCardLabels {
  primary: string;
  secondary: string | null;
}

export function libraryCardLabels(game: CardLabelSource): LibraryCardLabels {
  if (game.system !== "nes") {
    return {
      primary: game.title,
      secondary: game.originalTitle,
    };
  }

  const fileNameTitle = game.fileName.replace(/\.[^.]+$/, "");
  const metadataTitle = game.originalTitle?.trim();

  return metadataTitle
    ? { primary: metadataTitle, secondary: metadataTitle === fileNameTitle ? null : fileNameTitle }
    : { primary: fileNameTitle, secondary: null };
}
