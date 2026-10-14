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
import { MISSIONS } from '../shared/enemies';
import { MAPS, mapBossName } from '../shared/maps';
import { EVENTS, QUESTS } from '../shared/objectives';
import { PRESTIGE, PRESTIGE_IDS, prestigeCost, type PrestigeId, type PrestigeRanks } from '../shared/prestige';
import { DEV_NAME, type DevAction, type GameResult, type Pause, type PlayerState, type Snapshot } from '../shared/protocol';
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
} from '../shared/upgrades';
import type { Sound } from './audio';
import { iconEl, ultIconEl } from './icons';
import { portraitHtml } from './portraits';

const SPEAKER =
  '<path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/>';
const SPEAKER_ON = `<svg viewBox="0 0 24 24" aria-hidden="true">${SPEAKER}<path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const SPEAKER_OFF = `<svg viewBox="0 0 24 24" aria-hidden="true">${SPEAKER}<path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

const NAME_KEY = 'overrun.name';
const CHARACTER_KEY = 'overrun.character';
const CHOICE_KEYS = ['Digit1', 'Digit2', 'Digit3'];

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

const compact = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
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
  onJoin: (name: string, character: CharacterId) => void = () => {};
  onPick: (character: CharacterId) => void = () => {};
  onPickMap: (index: number) => void = () => {};
  onStart: () => void = () => {};
  onLobby: () => void = () => {};
  onChoose: (index: number) => void = () => {};
  onPrestige: (id: PrestigeId) => void = () => {};
  onRespec: () => void = () => {};
  onUnlock: (character: CharacterId) => void = () => {};
  onDev: (action: DevAction) => void = () => {};
  onReady: () => void = () => {};
  onGiveUp: () => void = () => {};

  private lobby = $('lobby');
  private joinForm = $('join-form');
  private nameInput = $<HTMLInputElement>('name');
  private room = $('room');
  private maps = $('maps');
  private characters = $('characters');
  private prestige = $('prestige');
  private prestigePoints = $('prestige-points');
  private playerList = $('player-list');
  private error = $('error');
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
  /** One health bar per final boss. */
  private bossViews: { name: HTMLElement; fill: HTMLElement; hp: HTMLElement }[] = [];
  private bossChip = $('boss-chip');
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
  private abilityE = $('ability-e');
  private abilityR = $('ability-r');
  private levelup = $('levelup');
  private chooseTimer = $('choose-timer');
  private cards = $('cards');
  private waiting = $('waiting');
  private gameover = $('gameover');
  private survived = $('survived');
  private results = $('results');
  private devPanel = $('dev-panel');
  private devGod = $('dev-god');
  private pauseMenu = $('pausemenu');
  private pauseBy = $('pause-by');
  private pausePlayers = $('pause-players');
  private pauseReady = $<HTMLButtonElement>('pause-ready');
  /** The hover tooltip, and what each hoverable element shows in it. */
  private tooltip = el('div', 'tooltip hidden');
  private tips = new WeakMap<HTMLElement, () => Tip>();
  private scoreboard = $('scoreboard');
  private scoreboardRows = $('scoreboard-rows');

  /** Held Tab: the scoreboard. Rebuilt a few times a second while open (damage numbers change constantly). */
  private scoreboardOpen = false;
  private scoreboardDrawnAt = 0;
  private latest: { snap: Snapshot; myId: number | null } | null = null;

  // Only rebuild DOM when the content actually changed (snapshots arrive 30 times a second).
  private shown = { pauseList: '', players: '', maps: '', prestige: '', characters: '', hero: '', abilities: '', options: '', waiting: '', loadout: '', result: '' };
  private bannerTimer = 0;

  constructor() {
    this.nameInput.value = load(NAME_KEY) ?? '';
    const join = () => {
      const name = this.nameInput.value.trim() || 'Player';
      save(NAME_KEY, name);
      this.error.textContent = '';
      const saved = load(CHARACTER_KEY);
      this.onJoin(name, isCharacterId(saved) ? saved : DEFAULT_CHARACTER);
    };
    $('join').addEventListener('click', join);
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') join();
    });
    $('start').addEventListener('click', () => this.onStart());
    $('restart').addEventListener('click', () => this.onStart());
    $('change-hero').addEventListener('click', () => this.onLobby());
    $('respec').addEventListener('click', () => this.onRespec());
    this.pauseReady.addEventListener('click', () => this.onReady());
    $('pause-giveup').addEventListener('click', () => {
      if (window.confirm('Give up this run for everyone and go back to the lobby? Prestige and gold earned so far are kept.')) this.onGiveUp();
    });
    document.body.append(this.tooltip);
    document.addEventListener('pointerover', (e) => {
      // Element, not HTMLElement: the pointer is often over an icon, which is SVG.
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>('.has-tip') : null;
      const build = target && this.tips.get(target);
      if (target && build) this.showTip(target, build());
      else this.tooltip.classList.add('hidden');
    });
    window.addEventListener('blur', () => this.tooltip.classList.add('hidden'));
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
    this.nameInput.focus();
  }

  /** The volume slider and mute button (also M). */
  bindSound(sound: Sound): void {
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

  showJoined(): void {
    this.joinForm.classList.add('hidden');
    this.room.classList.remove('hidden');
  }

  showDisconnected(reason: string): void {
    this.lobby.classList.remove('hidden');
    this.joinForm.classList.remove('hidden');
    for (const panel of [this.room, this.hud, this.levelup, this.gameover]) panel.classList.add('hidden');
    this.cards.replaceChildren();
    this.error.textContent = reason;
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
    this.latest = { snap, myId };
    if (this.scoreboardOpen) this.renderScoreboard(false);
    const me = snap.players.find((p) => p.id === myId);
    this.lobby.classList.toggle('hidden', snap.phase !== 'lobby');
    this.gameover.classList.toggle('hidden', snap.phase !== 'gameover');
    this.hud.classList.toggle('hidden', snap.phase === 'lobby');
    // God mode: the testing cheats.
    this.devPanel.classList.toggle('hidden', snap.phase !== 'playing' || me?.name.toLowerCase() !== DEV_NAME);
    const god = !!snap.me?.god;
    this.devGod.classList.toggle('on', god);
    this.devGod.firstChild!.textContent = god ? 'God mode: on ' : 'God mode: off ';

    if (snap.phase === 'lobby') {
      this.renderMaps(snap);
      this.renderPlayerList(snap);
      if (me && snap.me) this.renderCharacters(me, snap.me.heroes, snap.me.gold);
      if (me && snap.me) this.renderPrestige(me.prestige, snap.me.prestigePoints);
    }
    this.renderBoss(snap, me);
    this.xpFill.style.width = `${Math.min(100, (snap.xp / snap.xpNext) * 100)}%`;
    this.level.textContent = `Lv ${snap.level}`;
    this.timer.textContent = formatTime(snap.time);
    this.kills.textContent = `${me?.kills ?? 0} kills`;
    this.gold.textContent = `${snap.me?.gold ?? 0} gold`;
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
    this.levelup.classList.toggle('hidden', !pause);
    document.body.classList.toggle('paused', !!anyPause);
    this.renderPauseMenu(anyPause?.kind === 'menu' ? anyPause : null, snap, myId);
    if (pause) {
      this.chooseTitle.textContent = pause.reason === 'forge' ? 'The Forge: upgrade a weapon' : 'Level up!';
      this.chooseTimer.textContent = `${Math.ceil(pause.timeLeft)}s`;
      this.chooseTimer.classList.toggle('urgent', pause.timeLeft <= 5);
      this.renderOptions(snap.me?.options ?? null, snap.me?.upgrades ?? {});
      this.renderWaiting(snap, myId);
    } else {
      this.renderOptions(null, {});
    }

    if (snap.result) this.renderResult(snap.result);
  }

  // --- Lobby ---

  private renderMaps(snap: Snapshot): void {
    const key = `${snap.map}|${snap.unlocked}`;
    if (key === this.shown.maps) return;
    this.shown.maps = key;
    this.maps.replaceChildren(
      ...MAPS.map((map, i) => {
        const locked = i >= snap.unlocked;
        const card = el('button', `map-card${i === snap.map ? ' selected' : ''}${locked ? ' locked' : ''}`) as HTMLButtonElement;
        card.disabled = locked;
        const title = el('div', 'map-card-title');
        title.append(el('span', 'map-card-name', map.name), el('span', 'map-card-tag', map.arena ? 'Boss arena' : 'Open field'));
        card.append(
          title,
          el('div', 'map-card-sub', locked ? `Beat ${MAPS[i - 1].name} to unlock` : map.subtitle),
          el('div', 'map-card-boss', locked ? 'Final boss: ???' : `Final ${map.twin !== undefined ? 'bosses' : 'boss'}: ${mapBossName(map)}`),
          el('div', 'map-card-difficulty', `Enemies ×${map.difficulty} · Prestige ×${map.prestigeReward}`),
        );
        card.addEventListener('click', () => this.onPickMap(i));
        return card;
      }),
    );
  }

  private renderCharacters(me: PlayerState, unlocked: CharacterId[], gold: number): void {
    const key = `${me.character}|${me.color}|${unlocked.join(',')}|${gold}`;
    this.lobbyGold.textContent = `${gold} gold`;
    if (key === this.shown.characters) return;
    this.shown.characters = key;
    this.characters.replaceChildren(
      ...CHARACTER_IDS.map((id) => {
        const c = CHARACTERS[id];
        const locked = !heroAvailable(id, unlocked);
        const card = el('button', `hero-card${id === me.character ? ' selected' : ''}${locked ? ' locked' : ''}`);
        const info = el('div', 'hero-card-info');
        const title = el('div', 'hero-card-title');
        title.append(el('span', 'hero-card-name', c.name), el('span', `role ${c.role}`, c.role === 'ranged' ? 'Ranged' : 'Melee'));
        info.append(
          title,
          el('div', 'hero-card-sub', c.title),
          el('div', 'hero-card-stats', `${c.maxHp} HP · ${c.speed} speed`),
          el('div', 'hero-card-trait', c.trait),
          el('div', 'hero-card-weapon', `Starts with ${UPGRADES[c.startWeapon].name}`),
          el('div', 'hero-card-abilities', `E: ${UPGRADES[c.ability].name} · R: ${c.ultimate.name}`),
        );
        if (locked) info.append(el('div', 'hero-card-unlock', `Locked · buy for ${c.unlockCost} gold${gold < c.unlockCost! ? ` (you have ${gold})` : ''}`));
        card.append(portrait(id, me.color, 'portrait large'), info);
        card.addEventListener('click', () => {
          if (locked) {
            if (gold >= c.unlockCost! && window.confirm(`Buy ${c.name}, ${c.title} for ${c.unlockCost} gold?`)) this.onUnlock(id);
            return;
          }
          save(CHARACTER_KEY, id);
          this.onPick(id);
        });
        return card;
      }),
    );
  }

  /** The prestige shop: your unspent points and a row per upgrade with its rank and a buy button. */
  private renderPrestige(ranks: PrestigeRanks, points: number): void {
    const key = `${points}|${JSON.stringify(ranks)}`;
    if (key === this.shown.prestige) return;
    this.shown.prestige = key;
    this.prestigePoints.textContent = `${points} point${points === 1 ? '' : 's'}`;
    this.prestige.replaceChildren(
      ...PRESTIGE_IDS.map((id) => {
        const def = PRESTIGE[id];
        const rank = ranks[id] ?? 0;
        const maxed = rank >= def.maxRank;
        const cost = prestigeCost(rank);
        const row = el('div', 'prestige-row');
        const info = el('div', 'prestige-info');
        info.append(el('div', 'prestige-name', def.name), el('div', 'prestige-desc', rank > 0 ? def.describe(rank) : `${def.describe(1)} per rank`));
        const buy = el('button', 'prestige-buy', maxed ? 'Max' : `+1 · ${cost}`) as HTMLButtonElement;
        buy.disabled = maxed || points < cost;
        buy.title = maxed ? '' : `Rank ${rank + 1}: ${def.describe(rank + 1)}`;
        buy.addEventListener('click', () => this.onPrestige(id));
        row.append(info, pips(rank, def.maxRank), buy);
        return row;
      }),
    );
  }

  private renderPlayerList(snap: Snapshot): void {
    const key = snap.players.map((p) => `${p.id}:${p.name}:${p.character}`).join('|');
    if (key === this.shown.players) return;
    this.shown.players = key;
    this.playerList.replaceChildren(
      ...snap.players.map((p) => {
        const li = el('li');
        li.append(portrait(p.character, p.color, 'portrait tiny'), el('span', 'player-name', p.name), el('span', 'player-hero', CHARACTERS[p.character].name));
        return li;
      }),
    );
  }

  // --- HUD ---

  /** The boss health bar during the fight, otherwise a countdown to the boss or a warning to get to the arena. */
  private renderBoss(snap: Snapshot, me: PlayerState | undefined): void {
    const fight = snap.bossFight;
    this.bossBar.classList.toggle('hidden', !fight);
    this.missionChip.classList.toggle('hidden', !fight?.mission);
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
        const tags = [b.vengeful ? 'vengeful' : '', b.enraged ? 'enraged' : '', fight.mission && b.hp > 0 ? 'shielded' : ''].filter(Boolean);
        v.name.textContent = b.hp <= 0 ? `${b.name} (slain)` : tags.length ? `${b.name} (${tags.join(', ')})` : b.name;
        v.fill.style.width = `${(b.hp / b.maxHp) * 100}%`;
        v.fill.parentElement!.classList.toggle('shielded', !!fight.mission && b.hp > 0);
        v.hp.textContent = `${b.hp.toLocaleString('en-US')} / ${b.maxHp.toLocaleString('en-US')}`;
      });
      // The berserk clock.
      const berserk = fight.berserk > 0;
      this.bossStatus.classList.toggle('urgent', berserk || fight.berserkIn <= 30);
      this.bossStatus.textContent = berserk ? `BERSERK x${fight.berserk} · stronger every 30s` : `Berserk in ${formatTime(fight.berserkIn)}`;
      if (fight.mission) this.missionChip.textContent = `Shielded! ${MISSIONS[fight.mission.kind].goal} (${fight.mission.done}/${fight.mission.total})`;
    }
    let text = '';
    let urgent = false;
    const arena = snap.arena;
    const outsideArena = arena && arena.state !== 'idle' && me && !me.inArena && !me.downed;
    if (outsideArena) {
      // The fire is sweeping in: are you in it yet?
      urgent = true;
      const burning = Math.hypot(me.x - arena.x, me.y - arena.y) > arena.safeR;
      text = burning ? "You're burning! Get to the arena!" : fight ? 'Join the fight! The fire is closing in.' : 'Get to the arena! The fire is closing in.';
    } else if (snap.phase === 'playing' && !fight && (!arena || arena.state === 'idle') && snap.time < snap.bossTime) {
      text = `${mapBossName(MAPS[snap.map])} in ${formatTime(snap.bossTime - snap.time)}`;
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
    this.heroHpText.textContent = me.downed ? 'DOWN' : `${me.hp} / ${me.maxHp}`;
    this.hero.classList.toggle('down', me.downed);
  }

  /** The E and R slots: name, ability level, and a shade that drains as the cooldown runs out. */
  private renderAbilities(me: PlayerState, snap: Snapshot): void {
    const hero = CHARACTERS[me.character];
    const level = snap.me!.upgrades[hero.ability] ?? 0;
    const key = `${me.character}|${level}`;
    if (key !== this.shown.abilities) {
      this.shown.abilities = key;
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
    const { ability, ultimate } = snap.me!;
    show(this.abilityE, ability.cd, ability.cooldown);
    show(this.abilityR, ultimate.cd, ultimate.cooldown, ultimate.active);
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

  private showTip(target: HTMLElement, tip: Tip): void {
    const box = this.tooltip;
    let title = tip.icon ? iconName(tip.icon, tip.title, 24, 'tip-title') : el('div', 'tip-title', tip.title);
    if (tip.ult) {
      title = el('div', 'tip-title');
      title.append(ultIconEl(tip.ult, 24), el('span', 'icon-label', tip.title));
    }
    const tags = el('div', 'tip-tags');
    tags.append(...tip.tags.map((t) => el('span', t.cls, t.text)));
    box.replaceChildren(title, tags, ...tip.lines.map((l) => el('p', l.cls ?? '', l.text)));
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
  }

  private renderScoreboard(force: boolean): void {
    const now = performance.now();
    if (!this.latest || this.latest.snap.phase === 'lobby' || (!force && now - this.scoreboardDrawnAt < 250)) return;
    this.scoreboardDrawnAt = now;
    this.scoreboard.classList.remove('hidden');
    const { snap, myId } = this.latest;
    this.scoreboardRows.replaceChildren(...[...snap.players].sort((a, b) => b.damageDealt - a.damageDealt).map((p) => this.scoreRow(p, p.id === myId)));
  }

  private scoreRow(p: PlayerState, isMe: boolean): HTMLElement {
    const hero = CHARACTERS[p.character];
    const row = el('div', isMe ? 'score-row me' : 'score-row');

    // Who, and how they're doing.
    const who = el('div', 'score-who');
    const names = el('div', 'score-names');
    names.append(el('div', 'score-name', p.name), el('div', 'score-hero', `${hero.name}, ${hero.title}`));
    const hp = el('div', 'meter hp score-hp');
    const fill = el('div', `meter-fill${p.hp / p.maxHp <= 0.35 ? ' low' : ''}`);
    fill.style.width = `${Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100))}%`;
    hp.append(fill, el('span', '', p.downed ? 'DOWN' : `${p.hp} / ${p.maxHp}`));
    names.append(hp);
    who.append(portrait(p.character, p.color), names);

    const numbers = el('div', 'score-numbers');
    for (const [label, value] of [
      ['Kills', compact(p.kills)],
      ['Damage', compact(p.damageDealt)],
      ['Taken', compact(p.damageTaken)],
    ]) {
      const cell = el('div', 'score-number');
      cell.append(el('div', 'score-value', value), el('div', 'score-label', label));
      numbers.append(cell);
    }

    // Their build as icon tiles: E ability, R ultimate and weapons (big), then passives.
    const build = el('div', 'score-build');
    const tile = (id: UpgradeId, kind: 'ability' | 'weapon' | 'passive') => {
      const level = p.upgrades[id] ?? 0;
      const evolved = level >= EVOLVED_LEVEL;
      const t = el('div', `score-tile ${kind} ${typeOf(id)}${evolved ? ' evolved shimmer' : ''}`);
      t.append(iconEl(id, kind === 'passive' ? 26 : 38), el('div', 'score-tile-name', upgradeName(id, level)));
      if (!evolved) t.append(el('span', 'score-tile-level', String(level)));
      if (kind === 'ability') t.append(el('span', 'score-tile-key', 'E'));
      return t;
    };
    const ult = el('div', `score-tile ult${hero.ultimate.damage ? ` ${hero.ultimate.damage}` : ''}`);
    ult.append(ultIconEl(hero.ultimate.id, 38), el('div', 'score-tile-name', hero.ultimate.name), el('span', 'score-tile-key', 'R'));
    const weapons = el('div', 'score-tiles');
    weapons.append(tile(hero.ability, 'ability'), ult, ...ownedWeapons(p.upgrades).map((id) => tile(id, 'weapon')));
    const passives = el('div', 'score-tiles');
    const ownedP = ownedPassives(p.upgrades);
    passives.append(...ownedP.map((id) => tile(id, 'passive')));
    if (ownedP.length === 0) passives.append(el('span', 'score-none', 'No passives yet'));
    build.append(weapons, passives, el('div', 'score-stats', this.statLine(p)));

    row.append(who, numbers, build);
    return row;
  }

  /** Their stats from upgrades, listing only what differs from a fresh hero (plus speed and armor). */
  private statLine(p: PlayerState): string {
    const s = playerStats(p.upgrades, p.character, p.prestige);
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
    parts.push(`Armor ${percent(s.armor)}`, `Speed ${Math.round(s.speed)}`);
    const total = p.damageByType.reduce((a, b) => a + b, 0);
    if (total > 0) {
      const split = DAMAGE_TYPES.map((t, i) => [t, p.damageByType[i] / total] as const).filter(([, share]) => share >= 0.01);
      parts.push(`Damage ${split.map(([t, share]) => `${percent(share)} ${t}`).join(' / ')}`);
    }
    return parts.join(' · ');
  }

  // --- Level-up ---

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
        card.addEventListener('click', () => this.onChoose(i));
        return card;
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

  private renderResult(result: GameResult): void {
    const key = JSON.stringify(result);
    if (key === this.shown.result) return;
    this.shown.result = key;
    this.gameoverTitle.textContent = result.victory ? 'VICTORY' : 'OVERRUN';
    this.gameoverTitle.classList.toggle('victory', result.victory);
    this.survived.textContent = result.victory
      ? `You defeated ${result.boss} in ${formatTime(result.time)}!` + (result.unlockedMap ? ` ${result.unlockedMap} is now unlocked.` : '')
      : `Your team survived ${formatTime(result.time)} and reached level ${result.level}.`;
    const earned = [result.prestige > 0 ? `${result.prestige} prestige` : '', result.gold > 0 ? `${result.gold} gold` : ''].filter(Boolean);
    if (earned.length) this.survived.textContent += ` Everyone earned ${earned.join(' and ')}.`;
    const header = el('tr');
    header.append(el('th', '', 'Player'), el('th', '', 'Hero'), el('th', '', 'Kills'));
    const rows = [...result.players]
      .sort((x, y) => y.kills - x.kills)
      .map((p) => {
        const row = el('tr');
        const name = el('td');
        name.append(colorDot(p.color), p.name);
        row.append(name, el('td', '', CHARACTERS[p.character].name), el('td', '', String(p.kills)));
        return row;
      });
    this.results.replaceChildren(header, ...rows);
  }
}
