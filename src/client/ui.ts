import {
  CHARACTERS,
  CHARACTER_IDS,
  DEFAULT_CHARACTER,
  heroAvailable,
  isCharacterId,
  ownedPassives,
  ownedWeapons,
  playerStats,
  typeCounts,
  type CharacterId,
  type UltimateId,
} from '../shared/characters';
import { ARTIFACTS, TIERS, artifact, artifactSummary, describeActive, describeArtifact, type ArtifactId } from '../shared/artifacts';
import { HARD, MAX_PLAYERS } from '../shared/constants';
import { MODES } from '../shared/modes';
import { ENEMY_TYPES, EnemyType, MISSIONS } from '../shared/enemies';
import { ENDLESS_MAP, MAPS, inZone, mapBossName, onFinaleGround, waveBoss } from '../shared/maps';
import { PVP_TEAMS, PVP_TEAM_SIZE } from '../shared/pvp';
import { mapIconSvg } from './mapIcons';
import { EVENTS, QUESTS } from '../shared/objectives';
import { isDevName, type ArtifactFind, type DevAction, type GameResult, type Pause, type PlayerState, type Snapshot, type GameMode, type ProfileState } from '../shared/protocol';
import {
  EVOLVED_LEVEL,
  MAX_LEVEL,
  PASSIVE_SLOTS,
  UPGRADES,
  WEAPON_SLOTS,
  upgradeMax,
  type UpgradeId,
  type Upgrades,
  DAMAGE_NAMES,
  DAMAGE_TYPES,
  ATTUNEMENT,
  type DamageType,
  BONUSES,
  isBonus,
  type ChoiceId,
  ALL_UPGRADES,
  boostedBy,
  type PassiveId,
} from '../shared/upgrades';
import { artifactIcon, sortArtifacts, tierColor } from './artifactView';
import type { Sound } from './audio';
import { iconEl, ultIconEl } from './icons';
import { heroDetail, mystery, mysteryDetail } from './heroView';
import { portraitHtml } from './portraits';

const SPEAKER =
  '<path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/>';
const SPEAKER_ON = `<svg viewBox="0 0 24 24" aria-hidden="true">${SPEAKER}<path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const SPEAKER_OFF = `<svg viewBox="0 0 24 24" aria-hidden="true">${SPEAKER}<path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

const NAME_KEY = 'overrun.name';
const CHARACTER_KEY = 'overrun.character';
const CHOICE_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function colorDot(color: number): HTMLElement {
  const dot = el('span', 'dot');
  dot.style.background = `#${color.toString(16).padStart(6, '0')}`;
  return dot;
}

function portrait(character: CharacterId, color: number, className = 'portrait'): HTMLElement {
  const box = el('div', className);
  box.innerHTML = portraitHtml(character, color); // A bundled image, no user input.
  return box;
}

/** A row of `max` pips, `level` of them filled. Evolved weapons get a gold row. */
function pips(level: number, max = MAX_LEVEL): HTMLElement {
  const row = el('div', level >= EVOLVED_LEVEL ? 'pips evolved' : 'pips');
  for (let i = 0; i < max; i++) row.append(el('span', i < level ? 'pip on' : 'pip'));
  return row;
}

/** An exact number for chat, with thousands separators. */
const exact = (n: number) => Math.round(n).toLocaleString('en-US');

/** A weapon or passive as it reads in chat: name and level. */
function upgradeLine(id: UpgradeId, level: number): string {
  const evolved = level >= EVOLVED_LEVEL && UPGRADES[id].evolution;
  return `${upgradeName(id, level)} (${evolved ? 'evolved' : `level ${Math.max(1, level)}/${upgradeMax(id)}`})`;
}

/** The display name for an upgrade at a level (evolved weapons go by their evolution's name). */
function upgradeName(id: UpgradeId, level: number): string {
  const def = UPGRADES[id];
  return level >= EVOLVED_LEVEL && def.evolution ? def.evolution.name : def.name;
}

/** What a hover tooltip shows: a title, small colored tags, and lines of text. */
interface Tip {
  title: string;
  icon?: ChoiceId;
  /** Ultimates have their own icons. */
  ult?: UltimateId;
  /** Artifacts are drawn in their tier's frame. */
  artifact?: ArtifactId;
  tags: { text: string; cls: string }[];
  lines: { text: string; cls?: string }[];
}

/** The damage type of a weapon or ability, for coloring (abilities without damage count as physical). */
const typeOf = (id: UpgradeId): DamageType => UPGRADES[id].damage ?? 'physical';

/** Tooltip for a weapon or E ability at a level: what it does, and what comes next. */
function weaponTip(id: UpgradeId, level: number): Tip {
  const def = UPGRADES[id];
  const evolved = level >= EVOLVED_LEVEL && def.evolution;
  const strip = (text: string) => text.replace(/^\[E\] /, '');
  const tags = [{ text: DAMAGE_NAMES[typeOf(id)], cls: `damage-tag ${typeOf(id)}` }];
  tags.push(evolved ? { text: 'Evolved', cls: 'tip-evolved' } : { text: `Level ${Math.max(1, level)} / ${upgradeMax(id)}`, cls: 'tip-level' });
  if (def.owner) tags.push({ text: 'E ability', cls: 'tip-level' });
  const lines: Tip['lines'] = [{ text: strip(def.describe(Math.max(1, Math.min(level, MAX_LEVEL)))) }];
  const boosts = boostedBy(id);
  if (boosts.length > 0) lines.push({ text: `Boosted by: ${boosts.map((b) => UPGRADES[b].name).join(', ')}`, cls: 'tip-boosts' });
  if (evolved) lines.push({ text: `${def.evolution!.name}: ${def.evolution!.text}`, cls: 'tip-evo' });
  else if (level < upgradeMax(id)) lines.push({ text: `Next level: ${strip(def.describe(level + 1))}`, cls: 'tip-muted' });
  else if (def.evolution) lines.push({ text: `Evolves at a Forge into ${def.evolution.name}: ${def.evolution.text}`, cls: 'tip-muted' });
  return { title: upgradeName(id, level), icon: id, tags, lines };
}

function passiveTip(id: UpgradeId, level: number): Tip {
  return {
    title: UPGRADES[id].name,
    icon: id,
    tags: [{ text: `Level ${level} / ${upgradeMax(id)}`, cls: 'tip-level' }],
    lines: [{ text: `Each level: ${UPGRADES[id].describe(level)}` }],
  };
}

/** A slot's name with its icon in front. */
function iconName(id: ChoiceId, text: string, size: number, className = 'slot-name'): HTMLElement {
  const row = el('div', className);
  row.append(iconEl(id, size), el('span', 'icon-label', text));
  return row;
}

/** A big number, short: 950, 1.2k, 45k, 400k, 1.4M, 12M. */
const compact = (n: number) =>
  n >= 1e7
    ? `${(n / 1e6).toFixed(0)}M`
    : n >= 1e6
      ? `${(n / 1e6).toFixed(1)}M`
      : n >= 10000
        ? `${(n / 1000).toFixed(0)}k`
        : n >= 1000
          ? `${(n / 1000).toFixed(1)}k`
          : String(Math.round(n));
const percent = (v: number) => `${Math.round(v * 100)}%`;

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // Storage unavailable (private window etc.).
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not important if this fails.
  }
}

export const formatTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** The HTML overlays: lobby, HUD, loadout, level-up picks and game-over screen. */
export class UI {
  onPick: (character: CharacterId) => void = () => {};
  onPickMap: (index: number, mode: GameMode) => void = () => {};
  /** Your profile, for your endless records on the map cards. */
  private profile: ProfileState | null = null;

  setProfile(profile: ProfileState): void {
    this.profile = profile;
    this.shown.maps = ''; // Redraw the cards (new records).
  }
  onStart: () => void = () => {};
  onLobby: () => void = () => {};
  onChoose: (index: number) => void = () => {};
  /** Shift-clicked something shareable: say it in chat. */
  onShare: (text: string) => void = () => {};
  /** Open your profile (prestige and heroes) on top of the lobby. */
  onOpenProfile: () => void = () => {};
  onLeave: () => void = () => {};
  onDev: (action: DevAction) => void = () => {};
  onReady: () => void = () => {};
  onGiveUp: () => void = () => {};
  onAddBot: () => void = () => {};
  /** While you're down: whose camera to follow (null = your own). */
  onSpectate: (id: number | null) => void = () => {};
  private spectating: number | null = null;
  onRemoveBot: (id: number) => void = () => {};
  /** PvP lobby: join a team (index into PVP_TEAMS). */
  onTeam: (team: number) => void = () => {};
  /** Take an artifact into the run (null: none). */
  onEquip: (artifact: ArtifactId | null) => void = () => {};

  private lobby = $('lobby');
  private roomMode = $('room-mode');
  private roomCode = $('room-code');
  private roomCodeRow = $('room-code-row');
  private startButton = $<HTMLButtonElement>('start');
  private startNote = $('start-note');
  private maps = $('maps');
  private mapMode = $('map-mode');
  private hardTag = $('hard-tag');
  private characters = $('characters');
  private artifactPicker = $('artifact-picker');
  private artifactCount = $('artifact-count');
  private lootToasts = $('loot-toasts');
  private postgameLoot = $('postgame-loot');
  private heroDetail = $('hero-detail');
  /** The chat sits under the player list while you're in the lobby. */
  readonly lobbyChatDock = $('lobby-chat-dock');
  /** The hero shown in the detail panel: one you clicked (even if it's locked), else the one you play. */
  private viewing: CharacterId | null = null;
  private playerList = $('player-list');
  private hud = $('hud');
  private xpFill = $('xp-fill');
  private level = $('level');
  private timer = $('timer');
  private kills = $('kills');
  private gold = $('gold');
  private lobbyGold = $('lobby-gold');
  private banner = $('banner');
  private bossBar = $('boss-bar');
  private bossBars = $('boss-bars');
  private bossStatus = $('boss-status');
  private missionChip = $('mission-chip');
  /** The Warlord's health bar (the mini-boss), built once. */
  private warlordView = (() => {
    const name = el('div', 'boss-name', ENEMY_TYPES[EnemyType.Warlord].name);
    const meter = el('div', 'meter boss');
    const fill = el('div', 'meter-fill');
    const hp = el('span');
    meter.append(fill, hp);
    const wrap = el('div', 'boss-one');
    wrap.append(name, meter);
    return { fill, hp, wrap };
  })();
  /** One health bar per final boss. */
  private bossViews: { name: HTMLElement; fill: HTMLElement; hp: HTMLElement }[] = [];
  private bossChip = $('boss-chip');
  /** PvP: each team's level, kills, towers and crystal (above the boss chip). */
  private pvpBar = el('div', 'pvp-bar hidden');
  private gameoverTitle = $('gameover-title');
  private eventChip = $('event-chip');
  private questChip = $('quest-chip');
  private chooseTitle = $('choose-title');
  private hero = $('hero');
  private heroPortrait = $('hero-portrait');
  private heroName = $('hero-name');
  private heroHpFill = $('hero-hp-fill');
  private heroHpText = $('hero-hp-text');
  private heroDodge = $('hero-dodge');
  private heroDodgeFill = $('hero-dodge-fill');
  private slots = $('loadout-slots');
  private abilityQ = $('ability-q');
  private abilityE = $('ability-e');
  private abilityR = $('ability-r');
  private levelup = $('levelup');
  private chooseTimer = $('choose-timer');
  private cards = $('cards');
  private waiting = $('waiting');
  private gameover = $('gameover');
  private survived = $('survived');
  private postgameSummary = $('postgame-summary');
  private postgameRows = $('postgame-rows');
  private postgameNote = $('postgame-note');
  private backToLobby = $<HTMLButtonElement>('change-hero');
  private splash = $('splash');
  /** You've pressed Continue on the DEFEAT / VICTORY splash (reset when the next run ends). */
  private splashDone = false;
  /** The splash's rewards playing out (see playRewards): the result they're for, the frame, and how to skip to the end. */
  private rewardsFor = '';
  private rewardsFrame = 0;
  private skipRewards: (() => void) | null = null;
  private sound: Sound | null = null;
  private devPanel = $('dev-panel');
  private spectateBar = $('spectate');
  private spectateList = $('spectate-list');
  private addBot = $<HTMLButtonElement>('add-bot');
  private devGod = $('dev-god');
  private pauseMenu = $('pausemenu');
  private pauseBy = $('pause-by');
  private pausePlayers = $('pause-players');
  private pauseReady = $<HTMLButtonElement>('pause-ready');
  /** The hover tooltip, and what each hoverable element shows in it. */
  private tooltip = el('div', 'tooltip hidden');
  private tips = new WeakMap<HTMLElement, () => Tip>();
  /** Shift-click shares these in chat (the text is built at click time, so cooldowns are current). */
  private shares = new WeakMap<HTMLElement, () => string>();
  private scoreboard = $('scoreboard');
  private scoreboardRows = $('scoreboard-rows');

  /** You run the lobby. */
  private amHost = false;

  /** Held Tab: the scoreboard. Rebuilt a few times a second while open (damage numbers change constantly). */
  private scoreboardOpen = false;
  private scoreboardDrawnAt = 0;
  private latest: { snap: Snapshot; myId: number | null } | null = null;

  // Only rebuild DOM when the content actually changed (snapshots arrive 30 times a second).
  private shown = { pvp: '', spectate: '', pauseList: '', players: '', maps: '', characters: '', artifacts: '', heroDetail: '', hero: '', abilities: '', options: '', waiting: '', loadout: '', result: '' };
  private bannerTimer = 0;

  constructor() {
    // The host starts the game; everyone else says they're ready.
    this.startButton.addEventListener('click', () => (this.amHost ? this.onStart() : this.onReady()));
    this.backToLobby.addEventListener('click', () => this.onLobby());
    $('splash-continue').addEventListener('click', () => {
      this.splashDone = true;
      if (this.latest) this.update(this.latest.snap, this.latest.myId);
    });
    // A click anywhere else on the splash skips the counting to the end.
    this.splash.addEventListener('click', (e) => {
      if (e.target !== $('splash-continue')) this.skipRewards?.();
    });
    $('room-profile').addEventListener('click', () => this.onOpenProfile());
    $('room-leave').addEventListener('click', () => this.onLeave());
    this.pauseReady.addEventListener('click', () => this.onReady());
    this.addBot.addEventListener('click', () => this.onAddBot());
    $('pause-giveup').addEventListener('click', () => {
      if (window.confirm('Give up this run for everyone and go back to the lobby? Prestige and gold earned so far are kept.')) this.onGiveUp();
    });
    document.body.append(this.tooltip);
    this.bossChip.before(this.pvpBar);
    document.addEventListener('pointerover', (e) => {
      // Element, not HTMLElement: the pointer is often over an icon, which is SVG.
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>('.has-tip') : null;
      const build = target && this.tips.get(target);
      if (target && build) this.showTip(target, build());
      else this.tooltip.classList.add('hidden');
    });
    window.addEventListener('blur', () => this.tooltip.classList.add('hidden'));
    // Shift+click shares in chat; on the Tab screen a plain click does.
    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>('.can-share') : null;
      const build = target && this.shares.get(target);
      if (!build || !(e.shiftKey || this.scoreboard.contains(target))) return;
      e.preventDefault(); // No text selection.
      this.onShare(build());
    });
    for (const button of this.devPanel.querySelectorAll<HTMLButtonElement>('button[data-dev]')) {
      button.addEventListener('click', () => this.onDev(button.dataset.dev as DevAction));
    }
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || this.cards.childElementCount === 0) return;
      const index = CHOICE_KEYS.indexOf(e.code.replace('Numpad', 'Digit'));
      if (index >= 0) this.onChoose(index);
    });
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Tab' || e.target instanceof HTMLInputElement) return;
      e.preventDefault(); // Don't move focus around the page.
      if (!this.scoreboardOpen) {
        this.scoreboardOpen = true;
        this.renderScoreboard(true);
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Tab') this.closeScoreboard();
    });
    window.addEventListener('blur', () => this.closeScoreboard());
    // Clicked buttons keep focus, and Space would press them again instead of dodging.
    document.addEventListener('click', (e) => {
      if (e.target instanceof HTMLElement) e.target.closest('button')?.blur();
    });
  }

  /** The volume slider and mute button (also M). */
  bindSound(sound: Sound): void {
    this.sound = sound;
    const mute = $<HTMLButtonElement>('mute');
    const volume = $<HTMLInputElement>('volume');
    const refresh = () => {
      const silent = sound.isMuted() || sound.getVolume() === 0;
      mute.innerHTML = silent ? SPEAKER_OFF : SPEAKER_ON; // Static SVG.
      mute.classList.toggle('off', silent);
      volume.value = String(Math.round(sound.getVolume() * 100));
    };
    mute.addEventListener('click', () => {
      sound.setMuted(!sound.isMuted());
      refresh();
    });
    volume.addEventListener('input', () => {
      sound.setVolume(Number(volume.value) / 100);
      if (sound.isMuted()) sound.setMuted(false);
      refresh();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyM' || e.repeat || e.target instanceof HTMLInputElement) return;
      sound.setMuted(!sound.isMuted());
      refresh();
    });
    refresh();
  }

  /** Out of the room (left it, or the connection dropped): hide everything that belongs to a game. */
  leaveRoom(): void {
    for (const panel of [this.lobby, this.hud, this.levelup, this.gameover, this.splash, this.pauseMenu, this.spectateBar, this.devPanel, this.scoreboard]) {
      panel.classList.add('hidden');
    }
    document.body.classList.remove('paused');
    this.cards.replaceChildren();
    this.latest = null;
    this.viewing = null;
    for (const key of Object.keys(this.shown) as (keyof typeof this.shown)[]) this.shown[key] = '';
  }

  showBanner(text: string, tone: 'danger' | 'good'): void {
    this.banner.textContent = text;
    this.banner.classList.toggle('good', tone === 'good');
    this.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('show'), 3000);
  }

  /** How ready your dodge is, 0 (just used) to 1 (ready). Called every frame. */
  setDodge(ready: number): void {
    this.heroDodgeFill.style.width = `${Math.round(ready * 100)}%`;
    this.heroDodge.classList.toggle('ready', ready >= 1);
  }

  update(snap: Snapshot, myId: number | null): void {
    // A new screen (lobby, run, results): a tooltip from the old one would otherwise hang around until the mouse moves.
    if (this.latest && this.latest.snap.phase !== snap.phase) this.tooltip.classList.add('hidden');
    this.latest = { snap, myId };
    if (this.scoreboardOpen) this.renderScoreboard(false);
    const me = snap.players.find((p) => p.id === myId);
    this.lobby.classList.toggle('hidden', snap.phase !== 'lobby');
    // Run over: first the big DEFEAT / VICTORY, then (after Continue) the post-game screen.
    const over = snap.phase === 'gameover';
    if (!over) this.splashDone = false;
    this.splash.classList.toggle('hidden', !over || this.splashDone);
    this.gameover.classList.toggle('hidden', !over || !this.splashDone);
    // The splash lists what you found: no toasts on top of it.
    this.lootToasts.classList.toggle('hidden', over);
    this.hud.classList.toggle('hidden', snap.phase === 'lobby');
    // God mode: the testing cheats.
    this.devPanel.classList.toggle('hidden', snap.phase !== 'playing' || !isDevName(me?.name));
    const god = !!snap.me?.god;
    this.devGod.classList.toggle('on', god);
    this.devGod.firstChild!.textContent = god ? 'God mode: on ' : 'God mode: off ';

    this.amHost = !!me?.host;
    if (snap.phase === 'lobby') {
      this.renderRoomHead(snap);
      this.renderStart(snap, me);
      this.renderMaps(snap);
      this.renderPlayerList(snap);
      if (me && snap.me) {
        this.renderCharacters(me, snap.me.heroes, snap.me.gold);
        this.renderArtifactPicker(me, snap.me.artifacts, snap.mode === 'pvp');
        this.renderHeroDetail(me, snap.me.heroes, snap.me.gold);
      }
    }
    this.renderBoss(snap, me);
    // (PvP: your own team's level.)
    const team = snap.pvp && me && me.team >= 0 ? snap.pvp.teams[me.team] : undefined;
    this.xpFill.style.width = `${Math.min(100, ((team?.xp ?? snap.xp) / (team?.xpNext ?? snap.xpNext)) * 100)}%`;
    this.level.textContent = `Lv ${team?.level ?? snap.level}`;
    this.renderPvpBar(snap, me);
    this.timer.textContent = formatTime(snap.time);
    this.hardTag.classList.toggle('hidden', snap.mode === 'normal');
    this.hardTag.classList.toggle('endless', snap.mode === 'endless' || snap.mode === 'pvp');
    this.hardTag.textContent = snap.mode === 'hard' ? 'HARD' : snap.mode === 'pvp' ? 'PVP' : `ENDLESS · WAVE ${snap.wave}`;
    // (PvP: hero kills; and no gold, it's apart from the campaign.)
    this.kills.textContent = `${me?.kills ?? 0} ${snap.mode === 'pvp' ? 'slain' : 'kills'}`;
    this.gold.textContent = `${snap.me?.gold ?? 0} gold`;
    this.gold.classList.toggle('hidden', snap.mode === 'pvp');
    this.eventChip.classList.toggle('hidden', !snap.event);
    if (snap.event) this.eventChip.textContent = `${EVENTS[snap.event.kind].name} · ${Math.ceil(snap.event.timeLeft)}s`;
    this.questChip.classList.toggle('hidden', !snap.quest);
    if (snap.quest) {
      const quest = QUESTS[snap.quest.kind];
      this.questChip.textContent = `${quest.name}: ${quest.goal} · ${Math.ceil(snap.quest.timeLeft)}s`;
    }
    if (me && snap.me) {
      this.renderHero(me);
      this.renderAbilities(me, snap);
      this.renderLoadout(snap.me.upgrades);
    }

    const anyPause = snap.phase === 'playing' ? snap.pause : null;
    const pause = anyPause?.kind === 'choose' ? anyPause : null;
    // PvP: picks wait for you without pausing anything; they show at the bottom of the screen while you play.
    const livePick = snap.phase === 'playing' && !!snap.pvp && !!snap.me?.options;
    this.levelup.classList.toggle('hidden', !pause && !livePick);
    this.levelup.classList.toggle('live', livePick && !pause);
    document.body.classList.toggle('paused', !!anyPause);
    this.renderPauseMenu(anyPause?.kind === 'menu' ? anyPause : null, snap, myId);
    this.renderSpectate(snap, me);
    if (pause) {
      const swap = snap.me?.swapOut ?? null;
      this.chooseTitle.textContent =
        pause.reason === 'forge'
          ? 'The Forge: upgrade a weapon'
          : pause.reason === 'armory'
            ? swap
              ? `The Armory: what takes the place of ${UPGRADES[swap.id].name}?`
              : 'The Armory: trade in a weapon?'
            : 'Level up!';
      this.chooseTimer.textContent = `${Math.ceil(pause.timeLeft)}s`;
      this.chooseTimer.classList.toggle('urgent', pause.timeLeft <= 5);
      if (pause.reason === 'armory') this.renderArmory(snap.me?.options ?? null, snap.me?.upgrades ?? {}, swap);
      else this.renderOptions(snap.me?.options ?? null, snap.me?.upgrades ?? {});
      this.renderWaiting(snap, myId);
    } else if (livePick) {
      this.chooseTitle.textContent = 'Level up! Pick with 1, 2, 3';
      this.chooseTimer.textContent = '';
      this.renderOptions(snap.me!.options, snap.me!.upgrades);
      $('waiting').replaceChildren();
    } else {
      this.renderOptions(null, {});
    }

    if (snap.result && over) this.renderResult(snap.result, snap, me);
  }

  // --- Lobby ---

  private renderMaps(snap: Snapshot): void {
    const key = `${snap.map}|${snap.unlocked}|${snap.mode}|${snap.hardUnlocked}|${this.amHost}`;
    if (key === this.shown.maps) return;
    this.shown.maps = key;
    // Normal, hard (once Mordak has fallen) or endless: switching keeps the map if it's open on the other mode too.
    const mode = snap.mode;
    const hard = mode === 'hard';
    const modes: GameMode[] = [...(snap.hardUnlocked > 0 ? (['normal', 'hard', 'endless'] as const) : (['normal', 'endless'] as const)), 'pvp'];
    const MODE_INFO: Record<GameMode, [string, string]> = {
      normal: ['Normal', 'The maps as you first played them'],
      hard: ['Hard', 'Every map again: enemies hit harder, the horde is faster and bosses attack relentlessly, with new patterns. More prestige and better loot.'],
      pvp: ['PvP', 'Teams against each other, apart from the campaign (its own balance; no prestige, artifacts or gold): defend your crystal and towers, push your lanes with your minions, clear the jungle for XP, and destroy every other crystal.'],
      endless: ['Endless', 'No final victory: survive as long as you can. The boss comes back in waves, stronger each time, and the horde never stops growing. Armories let you trade in weapons.'],
    };
    this.mapMode.classList.remove('hidden');
    this.mapMode.replaceChildren(
      ...modes.map((m) => {
        const button = el('button', `map-mode-button ${m}${m === mode ? ' selected' : ''}`, MODE_INFO[m][0]) as HTMLButtonElement;
        button.disabled = !this.amHost;
        button.title = MODE_INFO[m][1];
        button.addEventListener('click', () => {
          if (m === mode) return;
          const campaign = Math.min(MAPS[snap.map].pvp || MAPS[snap.map].endless ? 0 : snap.map, (m === 'hard' ? snap.hardUnlocked : snap.unlocked) - 1);
          this.onPickMap(m === 'endless' ? ENDLESS_MAP : m === 'pvp' ? MAPS.findIndex((map) => map.pvp) : campaign, m);
        });
        return button;
      }),
    );
    this.maps.classList.toggle('hard', hard);
    this.maps.classList.toggle('endless', mode === 'endless');
    this.maps.replaceChildren(
      // Endless has its own map; the other modes show the campaign.
      ...MAPS.map((map, i) => ({ map, i }))
        .filter(({ map }) => (mode === 'endless' ? !!map.endless : mode === 'pvp' ? !!map.pvp : !map.endless && !map.pvp))
        .map(({ map, i }) => {
        const locked = !map.endless && !map.pvp && i >= (hard ? snap.hardUnlocked : snap.unlocked);
        const card = el('button', `map-card${i === snap.map ? ' selected' : ''}${locked ? ' locked' : ''}${this.amHost ? '' : ' readonly'}`) as HTMLButtonElement;
        card.disabled = locked || !this.amHost;
        // The details (description, boss, kind of finale) are in the hover text, to keep the cards small.
        const kind = map.arena ? 'Boss arena' : map.lava ? 'Closing lava' : 'Open field';
        // Maps are unlocked per account, and the room offers its host's.
        card.title = locked
          ? this.amHost
            ? `Beat ${MAPS[i - 1].name}${hard ? ' on hard mode' : ''} to unlock`
            : `${snap.players.find((p) => p.host)?.name ?? 'The host'} hasn't unlocked this map yet (the host's unlocks decide)`
          : map.pvp
            ? `${map.subtitle}${this.amHost ? '' : '\nThe host picks the map'}`
            : `${map.subtitle}\nFinal ${map.twin !== undefined ? 'bosses' : 'boss'}: ${mapBossName(map)} (${kind})${this.amHost ? '' : '\nThe host picks the map'}`;
        const icon = el('div', 'map-card-icon');
        icon.innerHTML = mapIconSvg(map, 54); // Static SVG.
        if (locked) icon.append(el('span', 'map-card-lock', '🔒'));
        card.append(
          icon,
          el('div', 'map-card-name', map.name),
          ...(map.pvp
            ? [el('div', 'map-card-difficulty', `${map.pvp.teams} teams`), el('div', 'map-card-difficulty', `Up to ${map.pvp.teams * PVP_TEAM_SIZE} heroes`)]
            : [
                el('div', 'map-card-difficulty', `Enemies ×${+(map.difficulty * (hard ? HARD.difficulty : 1)).toFixed(2)}`),
                el('div', 'map-card-difficulty', `Prestige ×${+(map.prestigeReward * (hard ? HARD.prestige : 1)).toFixed(2)}`),
              ]),
        );
        if (mode === 'endless' && !locked) {
          const best = this.profile?.endless[map.name];
          card.append(el('div', 'map-card-best', best ? `Best ${formatTime(best)}` : 'No run yet'));
        }
        card.addEventListener('click', () => this.onPickMap(i, mode));
        return card;
      }),
    );
  }

  /** The hero grid: portrait, name and title. Click one to see it in the detail panel (and play it, if you own it). */
  private renderCharacters(me: PlayerState, unlocked: CharacterId[], gold: number): void {
    const viewing = this.viewing ?? me.character;
    const key = `${me.character}|${viewing}|${me.color}|${me.ready}|${unlocked.join(',')}`;
    this.lobbyGold.textContent = `${gold} gold`;
    if (key === this.shown.characters) return;
    this.shown.characters = key;
    this.characters.classList.toggle('locked-in', !!me.ready && !me.host);
    this.characters.replaceChildren(
      ...CHARACTER_IDS.map((id) => {
        const c = CHARACTERS[id];
        const locked = !heroAvailable(id, unlocked);
        const card = el('button', `hero-tile${id === me.character ? ' selected' : ''}${id === viewing ? ' viewing' : ''}${locked ? ' locked' : ''}`) as HTMLButtonElement;
        // A secret hero stays a mystery until it's earned.
        if (locked && c.secret) card.append(mystery('hero-tile-portrait'), el('div', 'hero-tile-name', '???'), el('div', 'hero-tile-title', '???'));
        else card.append(portrait(id, me.color, 'portrait hero-tile-portrait'), el('div', 'hero-tile-name', c.name), el('div', 'hero-tile-title', c.title));
        if (locked) card.append(el('span', 'hero-tile-lock', c.secret ? 'Locked' : `${c.unlockCost} gold`));
        card.addEventListener('click', () => {
          this.viewing = id;
          // Locked in: you can look, but not swap until you unlock.
          if (!locked && !(me.ready && !me.host)) {
            save(CHARACTER_KEY, id);
            this.onPick(id);
          }
          this.shown.characters = '';
          this.shown.heroDetail = '';
          if (this.latest) this.update(this.latest.snap, this.latest.myId);
        });
        return card;
      }),
    );
  }

  /** An artifact's tooltip: tier, effects (drawbacks in red) and flavor. */
  private artifactTip(id: ArtifactId, extra?: string): Tip {
    const def = ARTIFACTS[id];
    return {
      title: def.name,
      artifact: id,
      tags: [
        { text: TIERS[def.tier].name, cls: `tip-tier tier-${def.tier}` },
        ...(def.active ? [{ text: `Q · ${def.active.cooldown}s cooldown`, cls: 'tip-level' }] : []),
      ],
      lines: [
        ...describeArtifact(id).map((l) => ({ text: l.text, cls: l.bad ? 'tip-bad' : 'tip-good' })),
        ...(def.active ? [{ text: `Q · ${def.active.name}`, cls: 'tip-active-head' }, ...describeActive(id).map((text) => ({ text, cls: 'tip-active' }))] : []),
        { text: def.flavor, cls: 'tip-flavor' },
        ...(extra ? [{ text: extra, cls: 'tip-note' }] : []),
      ],
    };
  }

  /** Your artifacts: click one to take it into the run (or the empty slot for none). Locked in, you can only look. */
  private renderArtifactPicker(me: PlayerState, owned: ArtifactId[], pvp = false): void {
    const lockedIn = !!me.ready && !me.host;
    const key = `${me.artifact}|${lockedIn}|${pvp}|${owned.join(',')}`;
    if (key === this.shown.artifacts) return;
    this.shown.artifacts = key;
    // (PvP leaves artifacts out: it's balanced on its own.)
    this.artifactPicker.classList.toggle('pvp-off', pvp);
    this.artifactCount.textContent = pvp ? 'Not used in PvP' : owned.length ? `${owned.length} owned` : '';
    this.artifactPicker.classList.toggle('locked-in', lockedIn);
    const tile = (id: ArtifactId | null) => {
      const t = el('button', `artifact-tile${id === me.artifact ? ' selected' : ''}`) as HTMLButtonElement;
      t.append(artifactIcon(id, 38));
      if (id) this.tip(t, () => this.artifactTip(id));
      else t.title = 'No artifact';
      t.addEventListener('click', () => {
        if (!lockedIn && id !== me.artifact) this.onEquip(id);
      });
      return t;
    };
    const desc = el('div', 'artifact-desc');
    if (me.artifact) {
      const def = ARTIFACTS[me.artifact];
      const name = el('span', 'artifact-desc-name', def.name);
      name.style.color = tierColor(def.tier);
      desc.append(name, el('span', 'artifact-desc-text', artifactSummary(me.artifact)));
    } else {
      desc.append(
        el('span', 'artifact-desc-text', owned.length ? 'No artifact equipped.' : 'Elites, warlords and final bosses drop artifacts. Find one to equip it here.'),
      );
    }
    this.artifactPicker.replaceChildren(...(owned.length ? [tile(null), ...sortArtifacts(owned).map(tile)] : []), desc);
  }

  /** Artifacts you just found: a toast for each, for a few seconds. */
  showFinds(found: ArtifactFind[]): void {
    for (const find of found) {
      const def = ARTIFACTS[find.id];
      const toast = el('div', 'loot-toast');
      toast.style.setProperty('--tier', tierColor(def.tier));
      const text = el('div', 'loot-toast-text');
      text.append(
        el('div', 'loot-toast-label', `${TIERS[def.tier].name} artifact!`),
        el('div', 'loot-toast-name', def.name),
        el('div', 'loot-toast-effects', artifactSummary(find.id)),
      );
      toast.append(artifactIcon(find.id, 44), text);
      this.lootToasts.append(toast);
      window.setTimeout(() => toast.classList.add('out'), 5000);
      window.setTimeout(() => toast.remove(), 5600);
    }
  }

  /** The selected hero up close: art, role, stats, trait, and the starting weapon and abilities with their icons. */
  private renderHeroDetail(me: PlayerState, unlocked: CharacterId[], gold: number): void {
    const id = this.viewing ?? me.character;
    const key = `${id}|${me.color}|${unlocked.join(',')}|${gold}`;
    if (key === this.shown.heroDetail) return;
    this.shown.heroDetail = key;
    const c = CHARACTERS[id];
    const locked = !heroAvailable(id, unlocked);

    if (locked && c.secret) {
      this.heroDetail.replaceChildren(...mysteryDetail());
      return;
    }
    this.heroDetail.replaceChildren(...heroDetail(id, me.color));
    if (locked && c.secret) {
    } else if (locked) {
      const unlock = el('button', 'secondary hero-unlock', `Unlock for ${c.unlockCost} gold${gold < c.unlockCost! ? ` (you have ${gold})` : ''}`) as HTMLButtonElement;
      unlock.addEventListener('click', () => this.onOpenProfile());
      this.heroDetail.append(unlock);
    }
  }

  /** The lobby's header: the mode, and the code to share (for modes friends can join). */
  private renderRoomHead(snap: Snapshot): void {
    const room = snap.room;
    this.roomMode.textContent = room ? MODES[room.mode].name : '';
    this.roomCodeRow.classList.toggle('hidden', !room || !MODES[room.mode].joinable);
    this.roomCode.textContent = room?.code ?? '';
  }

  /** The host gets Start (once everyone is ready); everyone else gets Ready. */
  private renderStart(snap: Snapshot, me: PlayerState | undefined): void {
    const waiting = snap.players.filter((p) => !p.host && !p.ready);
    // Looking at a hero you don't own: you can't lock that in.
    const viewingLocked = !!(this.viewing && me && snap.me && this.viewing !== me.character && !heroAvailable(this.viewing, snap.me.heroes));
    if (me?.host) {
      this.startButton.textContent = 'Start game';
      this.startButton.disabled = waiting.length > 0;
      this.startButton.classList.remove('is-ready');
      this.startNote.textContent =
        waiting.length > 0 ? `Waiting for ${waiting.map((p) => p.name).join(', ')} to lock in.` : 'Everyone is locked in.';
    } else {
      const host = snap.players.find((p) => p.host);
      this.startButton.disabled = viewingLocked && !me?.ready;
      this.startButton.textContent = me?.ready ? 'Locked in ✓' : 'Lock in';
      this.startButton.classList.toggle('is-ready', !!me?.ready);
      this.startNote.textContent = me?.ready
        ? `Waiting for ${host?.name ?? 'the host'} to start. Click again to change hero.`
        : `Pick your hero and lock in. ${host?.name ?? 'The host'} picks the map and starts.`;
    }
  }

  private renderPlayerList(snap: Snapshot): void {
    const pvp = MAPS[snap.map].pvp && snap.mode === 'pvp' ? MAPS[snap.map].pvp : undefined;
    const myId = this.latest?.myId;
    const key = `${this.amHost}|${snap.mode}|${snap.map}|${myId}|${snap.players.map((p) => `${p.id}:${p.name}:${p.character}:${p.artifact}:${p.bot}:${p.host}:${p.ready}:${p.team}`).join('|')}`;
    if (key === this.shown.players) return;
    this.shown.players = key;
    this.addBot.classList.toggle('hidden', !this.amHost);
    this.addBot.disabled = snap.players.length >= (pvp ? pvp.teams * PVP_TEAM_SIZE : MAX_PLAYERS);
    const row = (p: PlayerState) => {
        const li = el('li', p.bot ? 'is-bot' : '');
        const who = el('div', 'player-who');
        const top = el('div', 'player-top');
        top.append(el('span', 'player-name', p.name));
        if (p.host) top.append(el('span', 'player-tag host', 'Host'));
        who.append(top, el('span', 'player-hero', `${CHARACTERS[p.character].name}, ${CHARACTERS[p.character].title}`));
        li.append(portrait(p.character, p.color, 'portrait small'), who);
        if (p.artifact) {
          const relic = artifactIcon(p.artifact, 26);
          const artifactId = p.artifact;
          this.tip(relic, () => this.artifactTip(artifactId));
          li.append(relic);
        }
        if (!p.host) li.append(el('span', `player-tag${p.ready ? ' ready' : ''}`, p.bot ? 'Bot' : p.ready ? 'Locked in' : 'Picking…'));
        if (p.bot && this.amHost) {
          const remove = el('button', 'remove-bot', '×') as HTMLButtonElement;
          remove.title = 'Remove this bot';
          remove.addEventListener('click', () => this.onRemoveBot(p.id));
          li.append(remove);
        }
        return li;
    };
    if (!pvp) {
      this.playerList.replaceChildren(...snap.players.map(row));
      return;
    }
    // PvP: a block per team, with a button to join it (while it has room).
    const mine = snap.players.find((p) => p.id === myId)?.team;
    this.playerList.replaceChildren(
      ...PVP_TEAMS.slice(0, pvp.teams).flatMap((team, i) => {
        const members = snap.players.filter((p) => p.team === i);
        const head = el('li', 'team-head');
        head.style.setProperty('--team', `#${team.color.toString(16).padStart(6, '0')}`);
        head.append(el('span', 'team-name', team.name), el('span', 'team-count', `${members.length}/${PVP_TEAM_SIZE}`));
        if (mine !== i && members.length < PVP_TEAM_SIZE) {
          const join = el('button', 'link team-join', 'Join') as HTMLButtonElement;
          join.addEventListener('click', () => this.onTeam(i));
          head.append(join);
        }
        return [head, ...members.map(row)];
      }),
    );
  }

  // --- HUD ---

  /** PvP: a chip per team: its level, hero kills, towers left and its crystal's health (shielded, or broken). */
  private renderPvpBar(snap: Snapshot, me: PlayerState | undefined): void {
    const pvp = snap.phase === 'playing' ? snap.pvp : null;
    this.pvpBar.classList.toggle('hidden', !pvp);
    if (!pvp) return;
    const key = JSON.stringify(pvp.teams.map((t) => [t.level, t.kills, t.towers, Math.round(t.crystal * 100), t.shielded, t.buff > 0])) + (me?.team ?? -1);
    if (key === this.shown.pvp) return;
    this.shown.pvp = key;
    this.pvpBar.replaceChildren(
      ...pvp.teams.map((t, i) => {
        const chip = el('div', `pvp-team${i === me?.team ? ' mine' : ''}${t.crystal <= 0 ? ' out' : ''}`);
        chip.style.setProperty('--team', `#${PVP_TEAMS[i].color.toString(16).padStart(6, '0')}`);
        const meter = el('div', `pvp-crystal${t.shielded ? ' shielded' : ''}`);
        const fill = el('div', 'pvp-crystal-fill');
        fill.style.width = `${Math.round(t.crystal * 100)}%`;
        meter.append(fill);
        meter.title = t.crystal <= 0 ? 'Crystal destroyed' : t.shielded ? 'Crystal shielded until one of its towers falls' : 'Crystal exposed!';
        const stats = el('div', 'pvp-team-stats', `Lv ${t.level} · ${t.kills} ⚔ · ${t.towers} 🗼${t.buff > 0 ? ' · 💪' : ''}`);
        chip.append(el('div', 'pvp-team-name', PVP_TEAMS[i].name + (i === me?.team ? ' (you)' : '')), meter, stats);
        return chip;
      }),
    );
  }

  /** The boss health bar during the fight, otherwise a countdown to the boss or a warning to get to the arena. */
  private renderBoss(snap: Snapshot, me: PlayerState | undefined): void {
    const fight = snap.bossFight;
    // A Warlord out (and no final boss yet): the same bar, smaller, for a mini-boss fight.
    const warlord = !fight && snap.phase === 'playing' ? snap.warlord : null;
    this.bossBar.classList.toggle('hidden', !fight && !warlord);
    this.bossBar.classList.toggle('mini', !!warlord);
    this.missionChip.classList.toggle('hidden', !fight?.mission);
    if (warlord) {
      const v = this.warlordView;
      if (this.bossBars.firstChild !== v.wrap) {
        this.bossBars.replaceChildren(v.wrap);
        this.bossViews = []; // The final boss's bars get rebuilt when it comes.
      }
      v.fill.style.width = `${(warlord.hp / warlord.maxHp) * 100}%`;
      v.hp.textContent = `${warlord.hp.toLocaleString('en-US')} / ${warlord.maxHp.toLocaleString('en-US')}`;
      this.bossStatus.classList.remove('urgent');
      this.bossStatus.textContent = 'Mini-boss · the horde holds back while it lives';
    }
    if (fight) {
      if (this.bossViews.length !== fight.bosses.length) {
        this.bossViews = fight.bosses.map(() => {
          const name = el('div', 'boss-name');
          const meter = el('div', 'meter boss');
          const fill = el('div', 'meter-fill');
          const hp = el('span');
          meter.append(fill, hp);
          return { name, fill, hp };
        });
        this.bossBars.replaceChildren(
          ...this.bossViews.map((v) => {
            const wrap = el('div', 'boss-one');
            wrap.append(v.name, v.fill.parentElement!);
            return wrap;
          }),
        );
      }
      fight.bosses.forEach((b, i) => {
        const v = this.bossViews[i];
        const tags = [b.vengeful ? 'vengeful' : '', b.enraged ? 'enraged' : '', fight.mission && b.hp > 0 ? 'shielded' : '', ...b.tags].filter(Boolean);
        v.name.textContent = b.hp <= 0 ? `${b.name} (slain)` : tags.length ? `${b.name} (${tags.join(', ')})` : b.name;
        v.fill.style.width = `${(b.hp / b.maxHp) * 100}%`;
        v.fill.parentElement!.classList.toggle('shielded', !!fight.mission && b.hp > 0);
        v.hp.textContent = `${b.hp.toLocaleString('en-US')} / ${b.maxHp.toLocaleString('en-US')}`;
      });
      // The berserk clock.
      const berserk = fight.berserk > 0;
      this.bossStatus.classList.toggle('urgent', berserk || (fight.berserkIn >= 0 && fight.berserkIn <= 30));
      this.bossStatus.textContent = berserk ? `BERSERK x${fight.berserk} · stronger every 30s` : fight.berserkIn >= 0 ? `Berserk in ${formatTime(fight.berserkIn)}` : '';
      if (fight.mission) this.missionChip.textContent = `Shielded! ${MISSIONS[fight.mission.kind].goal} (${fight.mission.done}/${fight.mission.total})`;
    }
    let text = '';
    let urgent = false;
    const arena = snap.arena;
    const lava = snap.lava;
    // The caldera's finale: only its stones and den are safe now.
    const sunk = snap.finale && snap.finale.stage !== 'crumble' ? MAPS[snap.map].finale : undefined;
    const outsideArena = arena && arena.state !== 'idle' && me && !me.inArena && !me.downed && !snap.tower;
    const tower = snap.tower;
    if (snap.pvp) {
      // PvP: back in a moment, out of the game, or the next minion wave.
      urgent = !!me?.downed;
      text =
        me?.downed && me.respawn !== undefined
          ? me.respawn < 0
            ? 'Your crystal has fallen: your team is out'
            : `Respawning in ${Math.ceil(me.respawn)}s`
          : `Minions in ${Math.ceil(snap.pvp.nextWave)}s`;
    } else if (tower && tower.stage !== 'flee' && me && !me.inArena && !me.downed) {
      // The Frost Queen fled: after her, through the labyrinth.
      urgent = true;
      text = tower.stage === 'maze' ? 'Find your way through the labyrinth to her tower!' : 'She waits in her tower! Get inside.';
    } else if (outsideArena) {
      // The fire is sweeping in: are you in it yet?
      urgent = true;
      const def = MAPS[snap.map].arena;
      const burning = !!def && !inZone(def, me.x, me.y, arena.safeR);
      text = burning ? "You're burning! Get to the arena!" : fight ? 'Join the fight! The fire is closing in.' : 'The gates are open! Get to the arena.';
    } else if (lava && me && !me.downed && (sunk ? !onFinaleGround(sunk, me.x, me.y) : Math.hypot(me.x - lava.x, me.y - lava.y) > lava.r)) {
      urgent = true;
      text = sunk ? "You're in the lava! Jump to a stone!" : lava.closing ? "You're in the lava! Get to the middle!" : "You're in the lava! Get out!";
    } else if (lava?.closing) {
      urgent = true;
      text = `The lava is closing in! ${mapBossName(MAPS[snap.map])} ${MAPS[snap.map].twin ? 'arrive' : 'arrives'} when it stops.`;
    } else if (snap.phase === 'playing' && !fight && (!arena || arena.state === 'idle') && snap.time < snap.bossTime) {
      const next = snap.mode === 'endless' ? `Wave ${snap.wave + 1}: ${waveBoss(MAPS[snap.map], snap.wave + 1).name}` : mapBossName(MAPS[snap.map]);
      text = `${next} in ${formatTime(snap.bossTime - snap.time)}`;
    }
    this.bossChip.classList.toggle('hidden', !text);
    this.bossChip.classList.toggle('urgent', urgent);
    this.bossChip.textContent = text;
  }

  private renderHero(me: PlayerState): void {
    const key = `${me.character}|${me.color}`;
    if (key !== this.shown.hero) {
      this.shown.hero = key;
      this.heroPortrait.innerHTML = portraitHtml(me.character, me.color);
      this.heroName.textContent = `${CHARACTERS[me.character].name} · ${me.name}`;

    }
    const ratio = Math.max(0, Math.min(1, me.hp / me.maxHp));
    this.heroHpFill.style.width = `${ratio * 100}%`;
    this.heroHpFill.classList.toggle('low', ratio <= 0.35);
    this.heroHpText.textContent = me.downed ? 'FALLEN' : `${me.hp} / ${me.maxHp}`;
    this.hero.classList.toggle('down', me.downed);
  }

  /** The E and R slots: name, ability level, and a shade that drains as the cooldown runs out. */
  private renderAbilities(me: PlayerState, snap: Snapshot): void {
    const hero = CHARACTERS[me.character];
    const level = snap.me!.upgrades[hero.ability] ?? 0;
    const key = `${me.character}|${level}|${me.artifact}`;
    if (key !== this.shown.abilities) {
      this.shown.abilities = key;
      this.renderRelicSlot(me);
      this.abilityE.querySelector('.ability-name')!.replaceChildren(iconEl(hero.ability, 34), el('span', 'icon-label', upgradeName(hero.ability, level)));
      this.abilityE.querySelector('.ability-level')!.replaceChildren(pips(level));
      const eType = typeOf(hero.ability);
      const rType = hero.ultimate.damage;
      for (const t of DAMAGE_TYPES) {
        this.abilityE.classList.toggle(t, t === eType);
        this.abilityR.classList.toggle(t, t === rType);
      }
      this.abilityE.classList.toggle('shimmer', level >= EVOLVED_LEVEL);
      this.tip(this.abilityE, () => weaponTip(hero.ability, level));
      this.share(this.abilityE, () => {
        const cd = this.latest?.snap.me?.ability.cd ?? 0;
        return `${upgradeLine(hero.ability, level)} · ${cd > 0 ? `${Math.ceil(cd)}s cooldown` : 'ready'}`;
      });
      this.share(this.abilityR, () => {
        const ult = this.latest?.snap.me?.ultimate;
        const state = !ult ? '' : ult.active > 0 ? `active for ${Math.ceil(ult.active)}s` : ult.cd > 0 ? `${Math.ceil(ult.cd)}s cooldown` : 'ready';
        return `${hero.ultimate.name} (ultimate) · ${state}`;
      });
      this.abilityR.querySelector('.ability-name')!.replaceChildren(ultIconEl(hero.ultimate.id, 34), el('span', 'icon-label', hero.ultimate.name));
      this.tip(this.abilityR, () => ({
        title: hero.ultimate.name,
        ult: hero.ultimate.id,
        tags: [
          ...(rType ? [{ text: DAMAGE_NAMES[rType], cls: `damage-tag ${rType}` }] : []),
          { text: 'R ultimate', cls: 'tip-level' },
          { text: `${hero.ultimate.cooldown}s cooldown`, cls: 'tip-level' },
        ],
        lines: [{ text: hero.ultimate.text }],
      }));
    }
    const show = (slot: HTMLElement, cd: number, cooldown: number, active = 0) => {
      // Gray while cooling down; color sweeps back in clockwise as the timer runs out.
      const shade = slot.querySelector<HTMLElement>('.ability-shade')!;
      const done = cd > 0 && cooldown > 0 ? 1 - Math.min(1, cd / cooldown) : 1;
      shade.style.setProperty('--done', `${Math.round(done * 360)}deg`);
      slot.classList.toggle('cooling', done < 1);
      slot.querySelector('.ability-time')!.textContent = active > 0 ? `${Math.ceil(active)}s` : cd > 0 ? `${Math.ceil(cd)}` : '';
      slot.classList.toggle('ready', cd <= 0 && !me.downed);
      slot.classList.toggle('active', active > 0);
    };
    const { ability, ultimate, relic } = snap.me!;
    if (relic) show(this.abilityQ, relic.cd, relic.cooldown, relic.active);
    show(this.abilityE, ability.cd, ability.cooldown);
    show(this.abilityR, ultimate.cd, ultimate.cooldown, ultimate.active);
  }

  /** The Q slot: your artifact (empty without one). Passive-only artifacts show there too, but can't be pressed. */
  private renderRelicSlot(me: PlayerState): void {
    const slot = this.abilityQ;
    const id = me.artifact;
    const active = id ? artifact(id).active : undefined;
    slot.classList.toggle('empty', !id);
    slot.classList.toggle('passive', !!id && !active);
    slot.classList.remove('cooling', 'ready', 'active');
    slot.querySelector('.ability-time')!.textContent = '';
    slot.style.setProperty('--tier', id ? tierColor(ARTIFACTS[id].tier) : 'var(--border)');
    const name = slot.querySelector('.ability-name')!;
    if (!id) {
      name.replaceChildren(artifactIcon(null, 34), el('span', 'icon-label', 'No artifact'));
      this.tip(slot, () => ({
        title: 'Artifact',
        tags: [{ text: 'Q', cls: 'tip-level' }],
        lines: [{ text: 'Equip an artifact in the lobby to bring it into the run. Some can be activated with Q.' }],
      }));
      return;
    }
    name.replaceChildren(artifactIcon(id, 34), el('span', 'icon-label', active ? active.name : ARTIFACTS[id].name));
    slot.querySelector('.ability-level')!.replaceChildren(el('span', 'relic-note', active ? ARTIFACTS[id].name : 'Passive'));
    this.tip(slot, () => this.artifactTip(id));
    this.share(slot, () => {
      const relic = this.latest?.snap.me?.relic;
      const state = !relic ? '' : ` · ${relic.cd > 0 ? `${Math.ceil(relic.cd)}s cooldown` : 'ready'}`;
      return `${ARTIFACTS[id].name}: ${artifactSummary(id)}${state}`;
    });
  }

  /** A compact row of passive slots above the weapon slots (the E ability has its own slot). Empty slots show as "?". */
  private renderLoadout(upgrades: Upgrades): void {
    const key = JSON.stringify(upgrades);
    if (key === this.shown.loadout) return;
    this.shown.loadout = key;

    const passives = el('div', 'loadout-passives');
    const ownedP = ownedPassives(upgrades);
    for (let i = 0; i < PASSIVE_SLOTS; i++) {
      const id = ownedP[i];
      const chip = el('div', id ? 'slot passive' : 'slot passive empty');
      if (id) {
        const level = upgrades[id]!;
        chip.append(iconEl(id, 28), el('div', 'slot-name', UPGRADES[id].name), pips(level, upgradeMax(id)));
        this.tip(chip, () => passiveTip(id, level));
        this.share(chip, () => upgradeLine(id, level));
      } else {
        chip.append(el('div', 'slot-empty', '?'));
        chip.title = 'Empty passive slot';
      }
      passives.append(chip);
    }

    const weapons = el('div', 'loadout-weapons');
    const ownedW = ownedWeapons(upgrades);
    for (let i = 0; i < WEAPON_SLOTS; i++) {
      const id = ownedW[i];
      if (!id) {
        const empty = el('div', 'slot weapon empty');
        empty.append(el('div', 'slot-empty', '?'), el('div', 'slot-name', 'Empty'), pips(0));
        empty.title = 'Empty weapon slot';
        weapons.append(empty);
        continue;
      }
      const def = UPGRADES[id];
      const level = upgrades[id]!;
      const evolved = level >= EVOLVED_LEVEL && def.evolution;
      const card = el('div', `slot weapon ${typeOf(id)}${evolved ? ' evolved shimmer' : ''}`);
      card.append(iconEl(id, 44), el('div', 'slot-name', upgradeName(id, level)), pips(level));
      this.tip(card, () => weaponTip(id, level));
      this.share(card, () => upgradeLine(id, level));
      weapons.append(card);
    }
    this.slots.replaceChildren(passives, weapons);
  }

  // --- Tooltips ---

  /** Makes an element show a tooltip on hover (the content is built when it's shown, so it's always current). */
  private tip(target: HTMLElement, build: () => Tip): void {
    target.classList.add('has-tip');
    target.removeAttribute('title');
    this.tips.set(target, build);
  }

  /** Makes an element shareable in chat with Shift+click (a plain click on the Tab screen). */
  private share(target: HTMLElement, build: () => string): void {
    target.classList.add('can-share');
    this.shares.set(target, build);
  }

  private showTip(target: HTMLElement, tip: Tip): void {
    const box = this.tooltip;
    let title = tip.icon ? iconName(tip.icon, tip.title, 24, 'tip-title') : el('div', 'tip-title', tip.title);
    if (tip.ult) {
      title = el('div', 'tip-title');
      title.append(ultIconEl(tip.ult, 24), el('span', 'icon-label', tip.title));
    }
    if (tip.artifact) {
      title = el('div', 'tip-title');
      title.append(artifactIcon(tip.artifact, 26), el('span', 'icon-label', tip.title));
    }
    const tags = el('div', 'tip-tags');
    tags.append(...tip.tags.map((t) => el('span', t.cls, t.text)));
    box.replaceChildren(title, tags, ...tip.lines.map((l) => el('p', l.cls ?? '', l.text)));
    if (this.shares.has(target)) box.append(el('p', 'tip-share', `${this.scoreboard.contains(target) ? 'Click' : 'Shift+click'} to share in chat`));
    box.classList.remove('hidden');
    // Above the element, centered, kept on screen.
    const r = target.getBoundingClientRect();
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const y = r.top - h - 10 >= 8 ? r.top - h - 10 : r.bottom + 10;
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
  }

  // --- Scoreboard (hold Tab) ---

  private closeScoreboard(): void {
    this.scoreboardOpen = false;
    this.scoreboard.classList.add('hidden');
    this.tooltip.classList.add('hidden');
  }

  private renderScoreboard(force: boolean): void {
    const now = performance.now();
    if (!this.latest || this.latest.snap.phase === 'lobby' || (!force && now - this.scoreboardDrawnAt < 250)) return;
    this.scoreboardDrawnAt = now;
    this.scoreboard.classList.remove('hidden');
    const { snap, myId } = this.latest;
    this.scoreboardRows.replaceChildren(...[...snap.players].sort((a, b) => b.damageDealt - a.damageDealt).map((p) => this.scoreRow(p, p.id === myId)));
  }

  /** A player's row: who, their numbers, their build. `dealtBy`: after a run, the damage each weapon dealt (shown when hovering it). */
  private scoreRow(p: PlayerState, isMe: boolean, dealtBy?: Partial<Record<string, number>>): HTMLElement {
    const hero = CHARACTERS[p.character];
    const row = el('div', isMe ? 'score-row me' : 'score-row');

    // Who, and how they're doing.
    const who = el('div', 'score-who');
    const names = el('div', 'score-names');
    names.append(el('div', 'score-name', p.name), el('div', 'score-hero', `${hero.name}, ${hero.title}`));
    const hp = el('div', 'meter hp score-hp');
    const fill = el('div', `meter-fill${p.hp / p.maxHp <= 0.35 ? ' low' : ''}`);
    fill.style.width = `${Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100))}%`;
    hp.append(fill, el('span', '', p.downed ? 'FALLEN' : `${p.hp} / ${p.maxHp}`));
    names.append(hp);
    who.append(portrait(p.character, p.color), names);
    this.share(who, () => `(${p.name}) ${hero.name}, ${hero.title} · ${p.downed ? 'fallen' : `${p.hp}/${p.maxHp} HP`}`);

    const numbers = el('div', 'score-numbers');
    for (const [label, value, said] of [
      ['Kills', p.kills, 'kills'],
      ['Damage', p.damageDealt, 'damage'],
      ['Taken', p.damageTaken, 'damage taken'],
    ] as const) {
      const cell = el('div', 'score-number');
      cell.append(el('div', 'score-value', compact(value)), el('div', 'score-label', label));
      this.share(cell, () => `(${p.name}) ${exact(value)} ${said}`);
      numbers.append(cell);
    }
    // Their ultimate's charge: a ring that fills up, green when it's ready.
    const ready = p.ult >= 1;
    const ring = el('div', `ult-ring${ready ? ' ready' : ''}`);
    ring.style.setProperty('--charge', `${Math.round(Math.min(1, p.ult) * 360)}deg`);
    ring.append(ultIconEl(hero.ultimate.id, 18));
    this.tip(ring, () => ({
      title: hero.ultimate.name,
      ult: hero.ultimate.id,
      tags: [
        { text: ready ? 'Ready' : `${Math.round(p.ult * 100)}% charged`, cls: ready ? 'tip-ready' : 'tip-level' },
        { text: `${hero.ultimate.cooldown}s cooldown`, cls: 'tip-level' },
      ],
      lines: [{ text: hero.ultimate.text }],
    }));
    const ultCell = el('div', 'score-number');
    ultCell.append(ring, el('div', 'score-label', 'Ult'));
    this.share(ultCell, () => `(${p.name}) ${hero.ultimate.name} ${ready ? 'ready' : `${Math.round(p.ult * 100)}% charged`}`);
    numbers.append(ultCell);

    // Their build as icon tiles: weapons (big), then passives. Hero abilities are the same for everyone, so they're left out.
    const build = el('div', 'score-build');
    const tile = (id: UpgradeId, kind: 'weapon' | 'passive') => {
      const level = p.upgrades[id] ?? 0;
      const evolved = level >= EVOLVED_LEVEL;
      const t = el('div', `score-tile ${kind} ${typeOf(id)}${evolved ? ' evolved shimmer' : ''}`);
      t.append(iconEl(id, kind === 'passive' ? 26 : 38), el('div', 'score-tile-name', upgradeName(id, level)));
      if (!evolved) t.append(el('span', 'score-tile-level', String(level)));
      this.tip(t, () => {
        if (kind === 'passive') return passiveTip(id, level);
        const tip = weaponTip(id, level);
        // After a run: what it dealt, and its share of all their damage.
        const dealt = dealtBy?.[id];
        if (dealtBy) {
          const share = p.damageDealt > 0 ? Math.round(((dealt ?? 0) / p.damageDealt) * 100) : 0;
          tip.tags.unshift({ text: `${compact(dealt ?? 0)} damage`, cls: 'tip-damage' });
          tip.lines.unshift({ text: `Dealt ${exact(Math.round(dealt ?? 0))} damage this run (${share}% of ${isMe ? 'yours' : 'theirs'})`, cls: 'tip-dealt' });
        }
        return tip;
      });
      this.share(t, () => `(${p.name}) ${upgradeLine(id, level)}`);
      return t;
    };
    const weapons = el('div', 'score-tiles');
    weapons.append(...ownedWeapons(p.upgrades).map((id) => tile(id, 'weapon')));
    const passives = el('div', 'score-tiles');
    const ownedP = ownedPassives(p.upgrades);
    passives.append(...ownedP.map((id) => tile(id, 'passive')));
    if (ownedP.length === 0) passives.append(el('span', 'score-none', 'No passives yet'));
    if (p.artifact) {
      const relic = el('div', 'score-tile score-artifact');
      relic.append(artifactIcon(p.artifact, 30));
      const artifactId = p.artifact;
      this.tip(relic, () => this.artifactTip(artifactId));
      this.share(relic, () => `(${p.name}) ${ARTIFACTS[artifactId].name}: ${artifactSummary(artifactId)}`);
      passives.prepend(relic);
    }
    build.append(weapons, passives, el('div', 'score-stats', this.statLine(p)));

    row.append(who, numbers, build);
    return row;
  }

  /** Their stats from upgrades, listing only what differs from a fresh hero (plus speed and armor). */
  private statLine(p: PlayerState): string {
    const s = playerStats(p.upgrades, p.character, p.prestige, p.artifact);
    const base = playerStats({}, p.character);
    const parts: string[] = [];
    if (s.damageMult !== base.damageMult) parts.push(`Damage +${percent(s.damageMult / base.damageMult - 1)}`);
    if (s.cooldownMult !== 1) parts.push(`Cooldowns -${percent(1 - s.cooldownMult)}`);
    if (s.maxHp !== base.maxHp) parts.push(`Max HP ${s.maxHp}`);
    if (s.critChance) parts.push(`Crit ${percent(s.critChance)}`);
    for (const t of DAMAGE_TYPES) if (s.typeDamage[t] > 1.001) parts.push(`${DAMAGE_NAMES[t]} +${percent(s.typeDamage[t] - 1)}`);
    if (s.lifesteal) parts.push(`Lifesteal ${percent(s.lifesteal)}`);
    if (s.area !== 1) parts.push(`Area +${percent(s.area - 1)}`);
    if (s.duration !== 1) parts.push(`Duration +${percent(s.duration - 1)}`);
    if (s.projectiles) parts.push(`+${s.projectiles} projectiles`);
    if (s.evasion) parts.push(`Evasion ${percent(s.evasion)}`);
    if (s.xpMult !== 1) parts.push(`XP +${percent(s.xpMult - 1)}`);
    if (s.regen) parts.push(`Regen ${s.regen.toFixed(1)}/s`);
    if (s.damageTaken !== 1) parts.push(`Damage taken ${s.damageTaken > 1 ? '+' : '-'}${percent(Math.abs(s.damageTaken - 1))}`);
    parts.push(`Armor ${percent(s.armor)}`, `Speed ${Math.round(s.speed)}`);
    const total = p.damageByType.reduce((a, b) => a + b, 0);
    if (total > 0) {
      const split = DAMAGE_TYPES.map((t, i) => [t, p.damageByType[i] / total] as const).filter(([, share]) => share >= 0.01);
      parts.push(`Damage ${split.map(([t, share]) => `${percent(share)} ${t}`).join(' / ')}`);
    }
    return parts.join(' · ');
  }

  // --- Level-up ---

  /**
   * The Armory's cards. First your weapons, to trade one in (or keep them all, for a little gold); then three new
   * weapons, each shown at the level it would come in at.
   */
  private renderArmory(options: ChoiceId[] | null, upgrades: Upgrades, swap: { id: UpgradeId; level: number } | null): void {
    const key = `armory|${swap?.id ?? ''}|${options ? options.join(',') : ''}`;
    if (key === this.shown.options) return;
    this.shown.options = key;
    this.cards.replaceChildren(
      ...(options ?? []).map((id, i) => {
        const header = el('div', 'card-header');
        header.append(el('span', 'key', String(i + 1)));
        if (isBonus(id)) {
          const card = el('button', 'card bonus');
          header.append(el('span', 'tag', 'KEEP'));
          card.append(header, iconEl(id, 56), el('div', 'card-name', 'Keep your weapons'), el('p', 'card-desc', `Trade nothing in, and take ${BONUSES[id].text.toLowerCase()}`));
          card.addEventListener('click', () => this.onChoose(i));
          return card;
        }
        const def = UPGRADES[id];
        const card = el('button', `card weapon armory${def.damage ? ` ${def.damage}` : ''}`);
        const tags = el('span', 'card-tags');
        if (swap) {
          tags.append(el('span', 'tag', `NEW · Lv ${swap.level}`));
          if (def.damage) tags.append(el('span', `damage-tag ${def.damage}`, DAMAGE_NAMES[def.damage]));
          header.append(tags);
          card.append(header, iconEl(id, 56), el('div', 'card-name', def.name), el('p', 'card-desc', def.describe(swap.level)), pips(swap.level, upgradeMax(id)));
          card.append(this.boostRow(id, upgrades));
        } else {
          const level = upgrades[id] ?? 1;
          const evolved = level >= EVOLVED_LEVEL && def.evolution;
          tags.append(el('span', 'tag', 'TRADE IN'));
          header.append(tags);
          const name = evolved ? def.evolution!.name : def.name;
          const keeps = Math.min(MAX_LEVEL, level);
          const text = `Give up ${name} (Lv ${Math.min(level, MAX_LEVEL)}${evolved ? ', evolved' : ''}) and pick one of three new weapons to take its place, at Lv ${keeps}.`;
          card.append(header, iconEl(id, 56), el('div', 'card-name', name), el('p', 'card-desc', text), pips(keeps, upgradeMax(id)));
        }
        card.addEventListener('click', () => this.onChoose(i));
        return card;
      }),
    );
  }

  private renderOptions(options: ChoiceId[] | null, upgrades: Upgrades): void {
    const key = options ? options.join(',') : '';
    if (key === this.shown.options) return;
    this.shown.options = key;
    this.cards.replaceChildren(
      ...(options ?? []).map((id, i) => {
        if (isBonus(id)) {
          // Nothing left to upgrade: a heal or some gold.
          const card = el('button', 'card bonus');
          const header = el('div', 'card-header');
          header.append(el('span', 'key', String(i + 1)), el('span', 'tag', 'BONUS'));
          card.append(header, iconEl(id, 56), el('div', 'card-name', BONUSES[id].name), el('p', 'card-desc', BONUSES[id].text));
          card.addEventListener('click', () => this.onChoose(i));
          return card;
        }
        const def = UPGRADES[id];
        const next = (upgrades[id] ?? 0) + 1;
        const evolution = next >= EVOLVED_LEVEL ? def.evolution : undefined;
        const kind = evolution ? 'evolve shimmer' : def.owner ? 'hero-ability' : def.kind;
        const card = el('button', `card ${kind}${def.damage ? ` ${def.damage}` : ''}`);
        const header = el('div', 'card-header');
        header.append(el('span', 'key', String(i + 1)));
        const max = upgradeMax(id);
        const tag = evolution ? 'EVOLVE' : next === 1 ? 'NEW' : next === max ? 'MAX' : `Lv ${next}`;
        const tags = el('span', 'card-tags');
        tags.append(el('span', 'tag', tag));
        if (def.damage) tags.append(el('span', `damage-tag ${def.damage}`, DAMAGE_NAMES[def.damage]));
        header.append(tags);
        let text = evolution ? `${def.name} evolves: ${evolution.text}` : def.describe(next);
        // A new weapon of a type you already carry attunes you further.
        if (def.damage && next === 1 && typeCounts(upgrades)[def.damage] > 0) {
          text += ` Attunes: +${Math.round(ATTUNEMENT[def.damage] * 100)}% ${def.damage} damage.`;
        }
        card.append(header, iconEl(id, 56), el('div', 'card-name', evolution?.name ?? def.name), el('p', 'card-desc', text), pips(next, evolution ? MAX_LEVEL : max));
        card.append(this.boostRow(id, upgrades));
        card.addEventListener('click', () => this.onChoose(i));
        return card;
      }),
    );
  }

  /**
   * What makes this upgrade better or what it makes better: a weapon lists the passives that boost it (as icons); a
   * passive lists the weapons you carry that it boosts (or says none of them use it yet).
   */
  private boostRow(id: UpgradeId, upgrades: Upgrades): HTMLElement {
    const row = el('div', 'card-boosts');
    const def = UPGRADES[id];
    if (def.kind === 'weapon') {
      const boosts = boostedBy(id);
      if (boosts.length === 0) return row;
      row.append(el('span', 'card-boosts-label', 'Boosted by'));
      for (const b of boosts) {
        const icon = iconEl(b, 20);
        icon.title = UPGRADES[b].name;
        row.append(icon);
      }
      return row;
    }
    const mine = ownedWeapons(upgrades).filter((w) => boostedBy(w).includes(id as PassiveId));
    const specific = ALL_UPGRADES.some((w) => boostedBy(w).includes(id as PassiveId));
    if (!specific) return row; // Might, Haste and the like help everything.
    if (mine.length === 0) {
      row.append(el('span', 'card-boosts-label', 'None of your weapons use this yet'));
      return row;
    }
    row.append(el('span', 'card-boosts-label', 'Boosts'));
    for (const w of mine) {
      const icon = iconEl(w, 20);
      icon.title = UPGRADES[w].name;
      row.append(icon);
    }
    return row;
  }

  /** While you're down: your teammates' portraits; click one to follow their camera, or yourself to come back. */
  private renderSpectate(snap: Snapshot, me: PlayerState | undefined): void {
    const down = snap.phase === 'playing' && !!me?.downed;
    this.spectateBar.classList.toggle('hidden', !down);
    if (!down || !me) {
      if (this.spectating !== null) {
        this.spectating = null;
        this.onSpectate(null);
      }
      this.shown.spectate = '';
      return;
    }
    // PvP: only your own team's cameras.
    const watchable = snap.players.filter((p) => !snap.pvp || p.team === me.team);
    // Stop following someone who left.
    if (this.spectating !== null && !watchable.some((p) => p.id === this.spectating)) {
      this.spectating = null;
      this.onSpectate(null);
    }
    const key = `${this.spectating}|${watchable.map((p) => `${p.id}:${p.downed}:${p.character}`).join(',')}`;
    if (key === this.shown.spectate) return;
    this.shown.spectate = key;
    this.spectateList.replaceChildren(
      ...watchable.map((p) => {
        const mine = p.id === me.id;
        const watching = mine ? this.spectating === null : this.spectating === p.id;
        const b = el('button', `spectate-card${watching ? ' watching' : ''}${p.downed ? ' down' : ''}`) as HTMLButtonElement;
        b.append(portrait(p.character, p.color), el('span', 'spectate-name', mine ? 'You' : p.name));
        b.addEventListener('click', () => {
          this.spectating = mine ? null : p.id;
          this.onSpectate(this.spectating);
          this.shown.spectate = '';
        });
        return b;
      }),
    );
  }

  /** The pause screen: who paused, who's ready, and your Ready button. */
  private renderPauseMenu(pause: Extract<Pause, { kind: 'menu' }> | null, snap: Snapshot, myId: number | null): void {
    this.pauseMenu.classList.toggle('hidden', !pause);
    if (!pause) return;
    this.pauseBy.textContent = `Paused by ${pause.by}`;
    const imReady = myId !== null && pause.ready.includes(myId);
    this.pauseReady.textContent = imReady ? 'Ready ✓ (click to cancel)' : 'Ready';
    this.pauseReady.classList.toggle('is-ready', imReady);
    const key = `${pause.ready.join(',')}|${snap.players.map((p) => p.id).join(',')}`;
    if (key === this.shown.pauseList) return;
    this.shown.pauseList = key;
    this.pausePlayers.replaceChildren(
      ...snap.players.map((p) => {
        const ready = pause.ready.includes(p.id);
        const li = el('li', ready ? 'ready' : '');
        li.append(portrait(p.character, p.color, 'portrait tiny'), el('span', 'player-name', p.name), el('span', 'pause-state', ready ? 'Ready' : 'Not ready'));
        return li;
      }),
    );
  }

  private renderWaiting(snap: Snapshot, myId: number | null): void {
    const others = snap.players.filter((p) => p.choosing && p.id !== myId);
    const iChose = !snap.me?.options;
    const key = `${iChose}|${others.map((p) => p.id).join(',')}`;
    if (key === this.shown.waiting) return;
    this.shown.waiting = key;
    if (others.length === 0) {
      this.waiting.replaceChildren(iChose ? 'Starting…' : '');
      return;
    }
    const names = others.map((p) => {
      const span = el('span', 'waiting-name');
      span.append(colorDot(p.color), p.name);
      return span;
    });
    this.waiting.replaceChildren(iChose ? 'Waiting for ' : 'Still choosing: ', ...names);
  }

  // --- Game over ---

  /**
   * Under the VICTORY / DEFEAT: the prestige and gold you earned count up, then the artifacts you found appear one by
   * one, in the order you found them. Then Continue (to the post-game screen) appears. Clicking skips to the end.
   */
  private playRewards(result: GameResult, mine: GameResult['players'][number] | undefined): void {
    cancelAnimationFrame(this.rewardsFrame);
    const box = $('splash-rewards');
    const proceed = $('splash-continue');
    proceed.classList.add('waiting');
    proceed.classList.remove('shown');
    const prestige = result.pvp ? (mine?.kills ?? 0) : result.prestige;
    const gold = result.pvp ? Object.values(mine?.weapons ?? {}).reduce<number>((a, b) => a + (b ?? 0), 0) : (mine?.gold ?? 0);
    const loot = mine?.loot ?? [];
    const counter = (label: string, cls: string) => {
      const row = el('div', `splash-reward ${cls}`);
      const value = el('span', 'splash-reward-value', '+0');
      row.append(el('span', 'splash-reward-label', label), value);
      return { row, value };
    };
    const pvpGame = !!result.pvp;
    const p = counter(pvpGame ? 'Hero kills' : 'Prestige', 'prestige');
    const g = counter(pvpGame ? 'Damage dealt' : 'Gold', 'gold');
    const list = el('div', 'splash-loot');
    const cards = loot.map((find) => {
      const def = ARTIFACTS[find.id];
      const card = el('div', 'postgame-loot-card splash-loot-card pending');
      card.style.setProperty('--tier', tierColor(def.tier));
      const text = el('div', 'postgame-loot-text');
      text.append(el('div', 'postgame-loot-name', def.name), el('div', 'postgame-loot-note', TIERS[def.tier].name));
      card.append(artifactIcon(find.id, 34), text);
      this.tip(card, () => this.artifactTip(find.id));
      list.append(card);
      return card;
    });
    if (loot.length > 0) box.replaceChildren(p.row, g.row, el('div', 'splash-loot-title', `Artifacts found · ${loot.length}`), list);
    else box.replaceChildren(p.row, g.row);
    // The timeline (ms): wait for the title and the line under it, count, then a card at a time, then Continue.
    const START = 1300;
    const COUNT = 1400;
    const CARD = 320;
    const total = COUNT + loot.length * CARD + 250;
    const begin = performance.now() + START;
    let revealed = 0;
    let lastTick = 0;
    const show = (t: number) => {
      const k = Math.max(0, Math.min(1, t / COUNT));
      const eased = 1 - (1 - k) ** 3;
      p.value.textContent = `+${exact(Math.round(prestige * eased))}`;
      g.value.textContent = `+${exact(Math.round(gold * eased))}`;
      p.row.classList.toggle('counting', k > 0 && k < 1);
      g.row.classList.toggle('counting', k > 0 && k < 1);
      // Coins clink as it counts.
      if (k > 0 && k < 1 && (prestige > 0 || gold > 0) && t - lastTick > 110) {
        lastTick = t;
        this.sound?.play('coin', undefined, undefined, 0.9 + k * 0.4);
      }
      const due = Math.min(cards.length, Math.max(0, Math.floor((t - COUNT) / CARD) + 1));
      for (; revealed < due; revealed++) {
        cards[revealed].classList.remove('pending');
        this.sound?.play('relic');
      }
    };
    const finish = () => {
      cancelAnimationFrame(this.rewardsFrame);
      this.skipRewards = null;
      lastTick = Infinity; // (No more clinks.)
      revealed = cards.length; // (Skipped: shown all at once, without a sound each.)
      for (const card of cards) card.classList.remove('pending');
      show(total);
      proceed.classList.remove('waiting');
      proceed.classList.add('shown');
    };
    const frame = (now: number) => {
      const t = now - begin;
      if (t >= total) return finish();
      if (t >= 0) show(t);
      this.rewardsFrame = requestAnimationFrame(frame);
    };
    this.skipRewards = finish;
    this.rewardsFrame = requestAnimationFrame(frame);
  }

  private renderResult(result: GameResult, snap: Snapshot, me: PlayerState | undefined): void {
    const amHost = !!me?.host;
    // Only the host takes everyone back to the lobby.
    this.backToLobby.disabled = !amHost;
    const host = snap.players.find((p) => p.host);
    this.postgameNote.textContent = amHost ? '' : `Waiting for ${host?.name ?? 'the host'} to go back to the lobby.`;

    const key = `${JSON.stringify(result)}|${snap.players.map((p) => p.id).join(',')}`;
    if (key === this.shown.result) return;
    this.shown.result = key;
    const endless = result.endless;
    // Yours: the gold you banked, what you found, what you unlocked.
    const mine = result.players.find((r) => r.name === me?.name);
    // PvP: victory is your team's (whoever won, it's over for everyone).
    const pvpWon = result.pvp ? mine?.team === result.pvp.winner : null;
    const won = pvpWon ?? result.victory;
    const title = endless ? 'RUN OVER' : won ? 'VICTORY' : 'DEFEAT';
    for (const node of [this.gameoverTitle, $('splash-title')]) {
      node.textContent = title;
      node.classList.toggle('victory', won);
      node.classList.toggle('endless', !!endless);
    }
    const waves = endless ? `${endless.waves} boss ${endless.waves === 1 ? 'wave' : 'waves'} beaten` : '';
    const winner = result.pvp ? PVP_TEAMS[result.pvp.winner] : undefined;
    $('splash-sub').textContent = winner
      ? `${winner.name} destroyed every other crystal in ${formatTime(result.time)}`
      : endless
      ? `Survived ${formatTime(result.time)} · ${waves}${endless.record ? ' · New record!' : ''}`
      : result.victory
        ? `${result.boss} defeated in ${formatTime(result.time)}`
        : `Overrun at ${formatTime(result.time)}`;
    this.survived.textContent = winner
      ? `${winner.name} wins! ${result.pvp!.teams.map((t, i) => `${PVP_TEAMS[i].name}: level ${t.level}, ${t.kills} kills`).join(' · ')}.`
      : endless
      ? `Your team lasted ${formatTime(result.time)}, reached level ${result.level} and beat ${waves.replace(' beaten', '')}.${endless.record ? ' A new record on this map!' : ''}`
      : result.victory
      ? `You defeated ${result.boss} in ${formatTime(result.time)}!` + (mine?.unlockedMap ? ` ${mine.unlockedMap} is now unlocked.` : '') + (result.feats.length ? ` ${result.feats.join(' ')}` : '')
      : `Your team survived ${formatTime(result.time)} and reached level ${result.level}.`;
    const resultKey = JSON.stringify(result);
    if (resultKey !== this.rewardsFor) {
      this.rewardsFor = resultKey;
      this.playRewards(result, mine);
    }

    // The run in numbers, then what everyone takes home.
    const chip = (label: string, value: string, cls = '') => {
      const c = el('div', `postgame-chip ${cls}`);
      c.append(el('div', 'postgame-chip-value', value), el('div', 'postgame-chip-label', label));
      return c;
    };
    const kills = snap.players.reduce((sum, p) => sum + p.kills, 0);
    this.postgameSummary.replaceChildren(
      chip('Time', formatTime(result.time)),
      chip('Team level', String(result.level)),
      chip('Kills', exact(kills)),
      ...(winner
        ? [chip('Winner', winner.name, pvpWon ? 'gold' : '')]
        : [chip('Prestige gained', `+${result.prestige}`, 'prestige'), chip('Gold gained', `+${mine?.gold ?? result.gold}`, 'gold')]),
    );
    // What you found this run (yours are the ones under your name).
    const loot = mine?.loot ?? [];
    this.postgameLoot.classList.toggle('hidden', loot.length === 0);
    this.postgameLoot.replaceChildren();
    if (loot.length > 0) {
      this.postgameLoot.append(el('div', 'postgame-loot-title', `Artifacts found · ${loot.length}`));
      const row = el('div', 'postgame-loot-row');
      for (const find of loot) {
        const def = ARTIFACTS[find.id];
        const card = el('div', 'postgame-loot-card');
        card.style.setProperty('--tier', tierColor(def.tier));
        const text = el('div', 'postgame-loot-text');
        text.append(el('div', 'postgame-loot-name', def.name), el('div', 'postgame-loot-note', TIERS[def.tier].name));
        card.append(artifactIcon(find.id, 34), text);
        this.tip(card, () => this.artifactTip(find.id));
        row.append(card);
      }
      this.postgameLoot.append(row);
    }
    const myId = this.latest?.myId;
    this.postgameRows.replaceChildren(
      ...[...snap.players]
        .sort((a, b) => b.damageDealt - a.damageDealt)
        .map((p) => this.scoreRow(p, p.id === myId, result.players.find((r) => r.name === p.name)?.weapons)),
    );
  }
}
