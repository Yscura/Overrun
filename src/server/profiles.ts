// A player's progress between runs (prestige, gold, bought heroes), and the things you can do with it.
// Profiles are kept by lowercased name and saved in data/progress.json.

import { ARTIFACT_IDS, FORGE, WHEEL, artifact, isArtifactId, nextTier, rollArtifact, rollWheel, type ArtifactId } from '../shared/artifacts';
import { CHARACTERS, CHARACTER_IDS, heroAvailable, isCharacterId, type CharacterId } from '../shared/characters';
import { ENEMY_TYPES, isBossType } from '../shared/enemies';
import { CAMPAIGN } from '../shared/maps';
import { PRESTIGE, isPrestigeId, prestigeCost, prestigeSpent, type PrestigeRanks } from '../shared/prestige';
import { isDevName, type ArtifactFind, type HeroRecord, type ProfileState } from '../shared/protocol';

import type { Auth } from './accounts';

export interface Profile {
  /** The account's name as it was first written (profiles are kept by lowercased name), and its password (see accounts.ts). */
  display?: string;
  auth?: Auth;
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
  /** They've slain Mordak, the Earth Scourger: the Dragonmancer is theirs to unlock (once he's here). */
  dragonmancer?: boolean;
  /** How many campaign maps they've unlocked (at least 1), and on hard mode (0 until they've slain Mordak). */
  maps?: number;
  hardMaps?: number;
  /** Their longest endless run on each map (seconds, by map name). */
  endless?: Record<string, number>;
  /** How each hero's finished runs went (runs started are in `played`). */
  records?: Record<string, Omit<HeroRecord, 'runs'>>;
  /** Their artifact inventory: how many of each (by id). Older saves kept a list of ids. */
  artifacts?: Record<string, number>;
  artifact?: string | null;
}

/** How many of each artifact they have (ids that no longer exist are skipped). */
export function inventory(profile: Profile): Partial<Record<ArtifactId, number>> {
  const out: Partial<Record<ArtifactId, number>> = {};
  for (const [id, count] of Object.entries(profile.artifacts ?? {})) if (isArtifactId(id) && count > 0) out[id] = Math.floor(count);
  return out;
}

/** The artifacts they can equip: the ones in their inventory (for everyone, dev too: artifacts are earned). */
export function ownedArtifacts(profile: Profile): ArtifactId[] {
  return Object.keys(inventory(profile)) as ArtifactId[];
}

/** The artifact they take into runs, if they (still) have it. */
export function equippedArtifact(profile: Profile): ArtifactId | null {
  const id = profile.artifact;
  return isArtifactId(id) && ownedArtifacts(profile).includes(id) ? id : null;
}

/** Equips an artifact they have (or none, with null). False if they don't have it. */
export function equipArtifact(profile: Profile, id: unknown): boolean {
  if (id === null) {
    profile.artifact = null;
    return true;
  }
  if (!isArtifactId(id) || !ownedArtifacts(profile).includes(id)) return false;
  profile.artifact = id;
  return true;
}

/** An artifact goes into their inventory (on top of any they already have). */
export function giveArtifact(profile: Profile, id: ArtifactId): ArtifactFind {
  profile.artifacts ??= {};
  profile.artifacts[id] = (profile.artifacts[id] ?? 0) + 1;
  return { id };
}

/**
 * Combines FORGE.count artifacts of one tier (they can repeat, if they have that many) into a random one of the next
 * tier. Returns it, or null if the combination isn't allowed.
 */
export function combineArtifacts(profile: Profile, ids: unknown): ArtifactId | null {
  if (!Array.isArray(ids) || ids.length !== FORGE.count || !ids.every(isArtifactId)) return null;
  const tier = artifact(ids[0]).tier;
  const next = nextTier(tier);
  if (!next || ids.some((id) => artifact(id).tier !== tier)) return null;
  const have = inventory(profile);
  const using: Partial<Record<ArtifactId, number>> = {};
  for (const id of ids) using[id] = (using[id] ?? 0) + 1;
  if ((Object.keys(using) as ArtifactId[]).some((id) => (have[id] ?? 0) < using[id]!)) return null;
  for (const id of Object.keys(using) as ArtifactId[]) {
    profile.artifacts![id] = have[id]! - using[id]!;
    if (profile.artifacts![id] === 0) delete profile.artifacts![id];
  }
  if (!equippedArtifact(profile)) profile.artifact = null;
  const result = rollArtifact(next, ownedArtifacts(profile));
  giveArtifact(profile, result);
  return result;
}

/** Spins the artifact wheel. Returns what it gave, or null if they can't afford a spin. */
export function spinWheel(profile: Profile): ArtifactId | null {
  if ((profile.gold ?? 0) < WHEEL.cost) return null;
  profile.gold = (profile.gold ?? 0) - WHEEL.cost;
  const result = rollArtifact(rollWheel(), ownedArtifacts(profile));
  giveArtifact(profile, result);
  return result;
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
  // Artifacts used to be a list of the ones found; now they're an inventory with counts.
  if (Array.isArray(profile.artifacts)) profile.artifacts = Object.fromEntries((profile.artifacts as string[]).map((id) => [id, 1]));
  // The testing account always has at least one of every artifact (combining still uses them up, until next time), and
  // every map open.
  if (isDevName(key)) {
    profile.maps = CAMPAIGN;
    profile.hardMaps = CAMPAIGN;
    profile.artifacts ??= {};
    for (const id of ARTIFACT_IDS) profile.artifacts[id] = Math.max(1, profile.artifacts[id] ?? 0);
  }
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
    dragonmancer: !!profile.dragonmancer,
    endless: { ...(profile.endless ?? {}) },
    inventory: inventory(profile),
    equipped: equippedArtifact(profile),
  };
}
