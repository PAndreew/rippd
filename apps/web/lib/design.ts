import { GAME_THEME, GameKind } from '@rippd/shared';

export const CATEGORY_BADGE_TONES = [
  'border-emerald-300/40 bg-emerald-300/15 text-emerald-100',
  'border-sky-300/40 bg-sky-300/15 text-sky-100',
  'border-fuchsia-300/40 bg-fuchsia-300/15 text-fuchsia-100',
  'border-amber-300/45 bg-amber-300/15 text-amber-100'
] as const;

export const CATEGORY_BADGE_TONES_LIGHT = [
  'border-emerald-600 bg-emerald-100 text-emerald-900',
  'border-sky-600 bg-sky-100 text-sky-900',
  'border-fuchsia-600 bg-fuchsia-100 text-fuchsia-900',
  'border-amber-600 bg-amber-100 text-amber-900'
] as const;

export function getGameTheme(game: GameKind) {
  return GAME_THEME[game];
}
