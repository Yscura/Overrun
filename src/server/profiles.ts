// A player's progress between runs (prestige, gold, bought heroes), and the things you can do with it.
// Profiles are kept by lowercased name and saved in data/progress.json.

import { ARTIFACT_IDS, TIERS, artifact, isArtifactId, type ArtifactId } from '../shared/artifacts';
import { CHARACTERS, CHARACTER_IDS, heroAvailable, isCharacterId, type CharacterId } from '../shared/characters';
import { ENEMY_TYPES, isBossType } from '../shared/enemies';
import { PRESTIGE, isPrestigeId, prestigeCost, prestigeSpent, type PrestigeRanks } from '../shared/prestige';
import type { ArtifactFind, HeroRecord, ProfileState } from '../shared/protocol';

export interface Profile {
  /** Unspent prestige points. */
  points: number;
  ranks: PrestigeRanks;
  /** Gold from crates, spent on heroes. */
  gold?: number;
  /** Heroes bought with gold. */
  heroes?: string[];
  /** Runs started with each hero. */
  played?: Record<string, number>;
  /** The hero of the latest run. */
  lastHero?: string;
  /** Names of the bosses they've reached (won or not). */
  bosses?: string[];
  /** How each hero's finished runs went (runs started are in `played`). */
  records?: Record<string, Omit<HeroRecord, 'runs'>>;
  /** Artifacts they own (by id), and the one they take into runs. */
  artifacts?: string[];
  artifact?: string | null;
}

/** The artifacts they own (ids that no longer exist are skipped; all of them for testing setups). */
export function ownedArtifacts(profile: Profile, all = false): ArtifactId[] {
  return all ? [...ARTIFACT_IDS] : (profile.artifacts ?? []).filter(isArtifactId);
}

/** The artifact they take into runs, if they (still) own it. */
export function equippedArtifact(profile: Profile, all = false): ArtifactId | null {
  const id = profile.artifact;
  return isArtifactId(id) && ownedArtifacts(profile, all).includes(id) ? id : null;
}

/** Equips an owned artifact (or none, with null). False if they don't own it. */
export function equipArtifact(profile: Profile, id: unknown, all = false): boolean {
  if (id === null) {
    profile.artifact = null;
    return true;
  }
  if (!isArtifactId(id) || !ownedArtifacts(profile, all).includes(id)) return false;
  profile.artifact = id;
  return true;
}

/** They found an artifact: it goes in their inventory, or, if they already have it, it's salvaged for gold. */
export function giveArtifact(profile: Profile, id: ArtifactId): ArtifactFind {
  profile.artifacts ??= [];
  if (!profile.artifacts.includes(id)) {
    profile.artifacts.push(id);
    return { id, salvage: 0 };
  }
  const salvage = TIERS[artifact(id).tier].salvage;
  profile.gold = (profile.gold ?? 0) + salvage;
  return { id, salvage };
}

/** A run ended: add it to the hero's record. */
export function noteRun(profile: Profile, character: CharacterId, run: { victory: boolean; damage: number; kills: number; time: number }): void {
  profile.records ??= {};
  const r = (profile.records[character] ??= { wins: 0, kills: 0, bestDamage: 0, bestTime: 0 });
  if (run.victory) r.wins++;
  r.kills += run.kills;
  r.bestDamage = Math.max(r.bestDamage, Math.round(run.damage));
  r.bestTime = Math.max(r.bestTime, Math.round(run.time));
}

/** A run starts: count it for the hero they're playing. */
export function notePlayed(profile: Profile, character: CharacterId): void {
  profile.played ??= {};
  profile.played[character] = (profile.played[character] ?? 0) + 1;
  profile.lastHero = character;
}

/** They've reached a boss: its bestiary entry unlocks. True if it's new. */
export function noteBoss(profile: Profile, name: string): boolean {
  profile.bosses ??= [];
  if (profile.bosses.includes(name)) return false;
  profile.bosses.push(name);
  return true;
}

/** Their most-played hero; ties go to the one they played last. */
function favoriteHero(profile: Profile): CharacterId | null {
  let best: CharacterId | null = null;
  let most = 0;
  for (const [id, count] of Object.entries(profile.played ?? {})) {
    if (!isCharacterId(id)) continue;
    if (count > most || (count === most && id === profile.lastHero)) {
      best = id;
      most = count;
    }
  }
  return best;
}

/** The profile saved under this name, created on first sight. */
export function getProfile(store: Record<string, Profile>, name: string): Profile {
  const key = name.toLowerCase();
  const profile = (store[key] ??= { points: 0, ranks: {} });
  profile.ranks ??= {};
  // For a while the movement-speed prestige was saved as "Swiftness"; its id is "stride".
  const ranks = profile.ranks as Record<string, number | undefined>;
  if (ranks.Swiftness) {
    ranks.stride = (ranks.stride ?? 0) + ranks.Swiftness;
    delete ranks.Swiftness;
  }
  profile.points = Math.max(0, Number(profile.points) || 0);
  return profile;
}

/** Buys the next rank of a prestige upgrade. False if it can't be bought. */
export function buyPrestige(profile: Profile, id: unknown): boolean {
  if (!isPrestigeId(id)) return false;
  const rank = profile.ranks[id] ?? 0;
  const cost = prestigeCost(rank);
  if (rank >= PRESTIGE[id].maxRank || profile.points < cost) return false;
  profile.points -= cost;
  profile.ranks[id] = rank + 1;
  return true;
}

/** Refunds every prestige rank, for free (bought heroes stay bought). */
export function refundPrestige(profile: Profile): void {
  for (const rank of Object.values(profile.ranks)) profile.points += prestigeSpent(rank ?? 0);
  profile.ranks = {};
}

/** Buys a hero with gold. False if it's free, already owned, or too expensive. */
export function buyHero(profile: Profile, character: unknown, allHeroes: boolean): boolean {
  if (!isCharacterId(character)) return false;
  const cost = CHARACTERS[character].unlockCost;
  if (cost === undefined || allHeroes || heroAvailable(character, profile.heroes ?? []) || (profile.gold ?? 0) < cost) return false;
  profile.gold = (profile.gold ?? 0) - cost;
  profile.heroes = [...(profile.heroes ?? []), character];
  return true;
}

/** What the client's profile page shows. */
export function profileState(name: string, profile: Profile, allHeroes: boolean): ProfileState {
  return {
    name,
    points: profile.points,
    ranks: profile.ranks,
    gold: profile.gold ?? 0,
    heroes: allHeroes ? [...CHARACTER_IDS] : (profile.heroes ?? []).filter((h): h is CharacterId => isCharacterId(h)),
    favorite: favoriteHero(profile),
    runs: Object.values(profile.played ?? {}).reduce((sum, n) => sum + n, 0),
    wins: Object.values(profile.records ?? {}).reduce((sum, r) => sum + r.wins, 0),
    kills: Object.values(profile.records ?? {}).reduce((sum, r) => sum + r.kills, 0),
    records: Object.fromEntries(
      CHARACTER_IDS.filter((id) => profile.played?.[id] || profile.records?.[id]).map((id) => [
        id,
        { runs: profile.played?.[id] ?? 0, ...(profile.records?.[id] ?? { wins: 0, kills: 0, bestDamage: 0, bestTime: 0 }) },
      ]),
    ),
    // Testing setups see every boss, like every hero.
    bosses: allHeroes ? ENEMY_TYPES.filter((_, t) => isBossType(t)).map((e) => e.name) : (profile.bosses ?? []),
    artifacts: ownedArtifacts(profile, allHeroes),
    equipped: equippedArtifact(profile, allHeroes),
  };
}
