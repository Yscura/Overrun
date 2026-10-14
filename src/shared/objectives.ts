// Upgrade points ("shrines") on the map, and the timed events and quests they start.

/**
 * Stand inside a shrine to capture it. It fills faster the bigger share of the team is inside:
 * the whole team takes SHRINE_CAPTURE_TIME seconds, a lone player in a team of four about twice that.
 */
export const ShrineKind = { Forge: 0, Event: 1, Quest: 2, Sigil: 3 } as const;

export const SHRINES = [
  { name: 'Forge', hint: 'Upgrade a weapon (evolves max-level weapons and abilities)', color: 0xffa726 },
  { name: 'Altar', hint: 'A powerful effect for the whole team', color: 0x26c6da },
  { name: 'Quest', hint: 'Starts a quest with a gem reward', color: 0xffee58 },
  // Only during a boss side mission.
  { name: 'Sigil', hint: 'Stand in it to break the boss shield', color: 0xe040fb },
];

export const SHRINE_RADIUS = 100;
export const SHRINE_CAPTURE_TIME = 6;
/** Fill speed with a fraction f of the living team inside: SOLO_SHARE + (1 - SOLO_SHARE) * f. */
export const SHRINE_SOLO_SHARE = 0.4;
/** The first shrine appears this many seconds in, then one every SHRINE_INTERVAL while there's room. */
export const SHRINE_FIRST = 30;
export const SHRINE_INTERVAL = 40;
/** Altars and Quests stay until captured, but there are never more than this many at once. */
export const MAX_SHRINES = 2;
/**
 * Forges don't come at random: one appears at each of these points of the way to the final boss, and they
 * don't count toward MAX_SHRINES. Evolving all four weapons and the E ability takes 5 Forges, so a team
 * that captures every one can max everything, with one Forge to spare.
 */
export const FORGE_SCHEDULE = [0.25, 0.4, 0.55, 0.68, 0.8, 0.9];
/** New shrines keep at least this distance from existing ones. */
export const SHRINE_SPACING = 700;

// --- Timed events (Altar) ---

export type EventKind = 'freeze' | 'frenzy' | 'haste' | 'vacuum';
export const EVENT_DURATION = 20;

export const EVENTS: Record<EventKind, { name: string; banner: string }> = {
  freeze: { name: 'Deep Freeze', banner: 'Enemies are frozen solid!' },
  frenzy: { name: 'Frenzy', banner: 'Double damage!' },
  haste: { name: 'Haste', banner: 'Faster movement and attacks!' },
  vacuum: { name: 'Vacuum', banner: 'Gems fly to you from anywhere!' },
};

export const EVENT_KINDS = Object.keys(EVENTS) as EventKind[];

// --- Quests (from Quest points) ---

export type QuestKind = 'rally' | 'hunt';

export const QUESTS: Record<QuestKind, { name: string; goal: string }> = {
  rally: { name: 'Rally Point', goal: 'Get the whole team to the marker' },
  hunt: { name: 'Thief!', goal: 'Chase down and kill the gold thief' },
};

export const QUEST_KINDS = Object.keys(QUESTS) as QuestKind[];

export const RALLY_RADIUS = 120;
export const RALLY_TIME = 45;
/** How far from the team the rally point is placed. */
export const RALLY_DISTANCE = [1100, 1400] as const;
export const HUNT_TIME = 35;
/** Quest reward in XP, as a fraction of what the next level needs. Dropped as a shower of gems. */
export const QUEST_REWARD = 0.75;
