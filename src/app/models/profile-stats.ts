export type DistanceUnit = 'km' | 'mi';

export interface ProfileStats {
  level: number | null;
  distanceWalked: number | null;
  distanceUnit: DistanceUnit | null;
  pokemonCaught: number | null;
  pokestopsVisited: number | null;
  totalXp: number | null;
  username: string | null;
  entryName?: string | null;
}

export interface ProfileOcrResult {
  stats: ProfileStats;
  rawText: string;
}
