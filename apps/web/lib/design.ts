import { GAME_THEME, GameKind } from '@rippd/shared';

export const CATEGORY_BADGE_TONES = [
  'border-emerald-300/40 bg-emerald-300/15 text-emerald-100',
  'border-sky-300/40 bg-sky-300/15 text-sky-100',
  'border-fuchsia-300/40 bg-fuchsia-300/15 text-fuchsia-100',
  'border-amber-300/45 bg-amber-300/15 text-amber-100'
] as const;

export function getGameTheme(game: GameKind) {
  return GAME_THEME[game];
}
