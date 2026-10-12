// Prestige: permanent upgrades bought between runs with points earned by leveling up in runs.

export type PrestigeId = 'power' | 'fury' | 'stride' | 'fortitude' | 'resolve';
export type PrestigeRanks = Partial<Record<PrestigeId, number>>;

export interface PrestigeDef {
  name: string;
  /** What `rank` ranks give, for the shop. */
  describe: (rank: number) => string;
  maxRank: number;
}

/** Bonus per rank. */
export const PRESTIGE_BONUS = { power: 0.04, fury: 0.03, stride: 0.03, fortitude: 0.06, resolve: 0.02 };

export const PRESTIGE: Record<PrestigeId, PrestigeDef> = {
  power: { name: 'Power', describe: (r) => `+${Math.round(r * PRESTIGE_BONUS.power * 100)}% damage`, maxRank: 10 },
  fury: { name: 'Fury', describe: (r) => `+${Math.round(r * PRESTIGE_BONUS.fury * 100)}% attack speed`, maxRank: 10 },
  stride: { name: 'Stride', describe: (r) => `+${Math.round(r * PRESTIGE_BONUS.stride * 100)}% movement speed`, maxRank: 10 },
  fortitude: { name: 'Fortitude', describe: (r) => `+${Math.round(r * PRESTIGE_BONUS.fortitude * 100)}% max HP`, maxRank: 10 },
  resolve: { name: 'Resolve', describe: (r) => `${Math.round(r * PRESTIGE_BONUS.resolve * 100)}% less damage taken`, maxRank: 5 },
};

export const PRESTIGE_IDS = Object.keys(PRESTIGE) as PrestigeId[];

export function isPrestigeId(id: unknown): id is PrestigeId {
  return typeof id === 'string' && id in PRESTIGE;
}

/** Points the next rank costs when you have `rank`: 5, 10, 15, ... */
export const prestigeCost = (rank: number) => 5 * (rank + 1);

/** Points everything up to `rank` cost, for refunds. */
export const prestigeSpent = (rank: number) => (5 * rank * (rank + 1)) / 2;

/** Points for a run: one per team level gained, times the map's reward multiplier. */
export const prestigeReward = (level: number, mapReward: number) => Math.round((level - 1) * mapReward);
