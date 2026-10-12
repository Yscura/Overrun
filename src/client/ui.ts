import {
  CHARACTERS,
  CHARACTER_IDS,
  DEFAULT_CHARACTER,
  isCharacterId,
  ownedPassives,
  ownedWeapons,
  playerStats,
  type CharacterId,
} from '../shared/characters';
import { bossDisplayName } from '../shared/enemies';
import { MAPS } from '../shared/maps';
import { EVENTS, QUESTS } from '../shared/objectives';
import type { GameResult, PlayerState, Snapshot } from '../shared/protocol';
import {
  EVOLVED_LEVEL,
  MAX_LEVEL,
  PASSIVE_SLOTS,
  UPGRADES,
  WEAPON_SLOTS,
  upgradeMax,
  type UpgradeId,
  type Upgrades,
} from '../shared/upgrades';
import type { Sound } from './audio';
import { portraitSvg } from './portraits';

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
  box.innerHTML = portraitSvg(character, color); // Static SVG, no user input.
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

  private lobby = $('lobby');
  private joinForm = $('join-form');
  private nameInput = $<HTMLInputElement>('name');
  private room = $('room');
  private maps = $('maps');
  private characters = $('characters');
  private playerList = $('player-list');
  private error = $('error');
  private hud = $('hud');
  private xpFill = $('xp-fill');
  private level = $('level');
  private timer = $('timer');
  private kills = $('kills');
  private banner = $('banner');
  private bossBar = $('boss-bar');
  private bossName = $('boss-name');
  private bossFill = $('boss-fill');
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
  private scoreboard = $('scoreboard');
  private scoreboardRows = $('scoreboard-rows');

  /** Held Tab: the scoreboard. Rebuilt a few times a second while open (damage numbers change constantly). */
  private scoreboardOpen = false;
  private scoreboardDrawnAt = 0;
  private latest: { snap: Snapshot; myId: number | null } | null = null;

  // Only rebuild DOM when the content actually changed (snapshots arrive 30 times a second).
  private shown = { players: '', maps: '', characters: '', hero: '', abilities: '', options: '', waiting: '', loadout: '', result: '' };
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

    if (snap.phase === 'lobby') {
      this.renderMaps(snap);
      this.renderPlayerList(snap);
      if (me) this.renderCharacters(me);
    }
    this.renderBoss(snap, me);
    this.xpFill.style.width = `${Math.min(100, (snap.xp / snap.xpNext) * 100)}%`;
    this.level.textContent = `Lv ${snap.level}`;
    this.timer.textContent = formatTime(snap.time);
    this.kills.textContent = `${me?.kills ?? 0} kills`;
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

    const pause = snap.phase === 'playing' ? snap.pause : null;
    this.levelup.classList.toggle('hidden', !pause);
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
          el('div', 'map-card-boss', locked ? 'Final boss: ???' : `Final boss: ${bossDisplayName(map.boss)}`),
        );
        card.addEventListener('click', () => this.onPickMap(i));
        return card;
      }),
    );
  }

  private renderCharacters(me: PlayerState): void {
    const key = `${me.character}|${me.color}`;
    if (key === this.shown.characters) return;
    this.shown.characters = key;
    this.characters.replaceChildren(
      ...CHARACTER_IDS.map((id) => {
        const c = CHARACTERS[id];
        const card = el('button', id === me.character ? 'hero-card selected' : 'hero-card');
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
        card.append(portrait(id, me.color), info);
        card.addEventListener('click', () => {
          save(CHARACTER_KEY, id);
          this.onPick(id);
        });
        return card;
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
    this.bossBar.classList.toggle('hidden', !snap.boss);
    if (snap.boss) {
      this.bossName.textContent = snap.boss.enraged ? `${snap.boss.name} (enraged)` : snap.boss.name;
      this.bossFill.style.width = `${(snap.boss.hp / snap.boss.maxHp) * 100}%`;
    }
    let text = '';
    let urgent = false;
    const arena = snap.arena;
    const outsideArena = arena && arena.state !== 'idle' && me && !me.inArena && !me.downed;
    if (outsideArena) {
      // The fire is sweeping in: are you in it yet?
      urgent = true;
      const burning = Math.hypot(me.x - arena.x, me.y - arena.y) > arena.safeR;
      text = burning ? "You're burning! Get to the arena!" : snap.boss ? 'Join the fight! The fire is closing in.' : 'Get to the arena! The fire is closing in.';
    } else if (snap.phase === 'playing' && !snap.boss && (!arena || arena.state === 'idle') && snap.time < snap.bossTime) {
      text = `${bossDisplayName(MAPS[snap.map].boss)} in ${formatTime(snap.bossTime - snap.time)}`;
    }
    this.bossChip.classList.toggle('hidden', !text);
    this.bossChip.classList.toggle('urgent', urgent);
    this.bossChip.textContent = text;
  }

  private renderHero(me: PlayerState): void {
    const key = `${me.character}|${me.color}`;
    if (key !== this.shown.hero) {
      this.shown.hero = key;
      this.heroPortrait.innerHTML = portraitSvg(me.character, me.color);
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
      this.abilityE.querySelector('.ability-name')!.textContent = UPGRADES[hero.ability].name;
      this.abilityE.querySelector('.ability-level')!.replaceChildren(pips(level));
      this.abilityE.title = UPGRADES[hero.ability].describe(Math.max(1, level));
      this.abilityR.querySelector('.ability-name')!.textContent = hero.ultimate.name;
      this.abilityR.title = `${hero.ultimate.text} ${hero.ultimate.cooldown}s cooldown.`;
    }
    const show = (slot: HTMLElement, cd: number, cooldown: number, active = 0) => {
      const shade = slot.querySelector<HTMLElement>('.ability-shade')!;
      shade.style.height = `${cooldown > 0 ? Math.min(100, (cd / cooldown) * 100) : 0}%`;
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
        chip.append(el('div', 'slot-name', UPGRADES[id].name), pips(level, upgradeMax(id)));
        chip.title = UPGRADES[id].describe(level);
      } else {
        chip.append(el('div', 'slot-name', '?'));
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
        empty.append(el('div', 'slot-name', '?'), pips(0));
        empty.title = 'Empty weapon slot';
        weapons.append(empty);
        continue;
      }
      const def = UPGRADES[id];
      const level = upgrades[id]!;
      const evolved = level >= EVOLVED_LEVEL && def.evolution;
      const card = el('div', evolved ? 'slot weapon evolved' : 'slot weapon');
      card.append(el('div', 'slot-name', upgradeName(id, level)), pips(level));
      card.title = evolved ? evolved.text : def.describe(level);
      weapons.append(card);
    }
    this.slots.replaceChildren(passives, weapons);
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

    // Their build: E ability, weapons, passives.
    const build = el('div', 'score-build');
    const chip = (id: UpgradeId, kind: string) => {
      const level = p.upgrades[id] ?? 0;
      const c = el('span', `score-chip ${kind}${level >= EVOLVED_LEVEL ? ' evolved' : ''}`);
      c.append(el('span', '', upgradeName(id, level)), el('span', 'score-chip-level', level >= EVOLVED_LEVEL ? 'EVO' : String(level)));
      c.title = UPGRADES[id].describe(level);
      return c;
    };
    const weapons = el('div', 'score-chips');
    weapons.append(chip(hero.ability, 'ability'), ...ownedWeapons(p.upgrades).map((id) => chip(id, 'weapon')));
    const passives = el('div', 'score-chips');
    const ownedP = ownedPassives(p.upgrades);
    passives.append(...ownedP.map((id) => chip(id, 'passive')));
    if (ownedP.length === 0) passives.append(el('span', 'score-none', 'No passives yet'));
    build.append(weapons, passives, el('div', 'score-stats', this.statLine(p)));

    row.append(who, numbers, build);
    return row;
  }

  /** Their stats from upgrades, listing only what differs from a fresh hero (plus speed and armor). */
  private statLine(p: PlayerState): string {
    const s = playerStats(p.upgrades, p.character);
    const base = playerStats({}, p.character);
    const parts: string[] = [];
    if (s.damageMult !== base.damageMult) parts.push(`Damage +${percent(s.damageMult / base.damageMult - 1)}`);
    if (s.cooldownMult !== 1) parts.push(`Cooldowns -${percent(1 - s.cooldownMult)}`);
    if (s.critChance) parts.push(`Crit ${percent(s.critChance)}`);
    if (s.lifesteal) parts.push(`Lifesteal ${percent(s.lifesteal)}`);
    if (s.area !== 1) parts.push(`Area +${percent(s.area - 1)}`);
    if (s.duration !== 1) parts.push(`Duration +${percent(s.duration - 1)}`);
    if (s.projectiles) parts.push(`+${s.projectiles} projectiles`);
    if (s.evasion) parts.push(`Evasion ${percent(s.evasion)}`);
    if (s.xpMult !== 1) parts.push(`XP +${percent(s.xpMult - 1)}`);
    if (s.regen) parts.push(`Regen ${s.regen.toFixed(1)}/s`);
    parts.push(`Armor ${percent(s.armor)}`, `Speed ${Math.round(s.speed)}`);
    return parts.join(' · ');
  }

  // --- Level-up ---

  private renderOptions(options: UpgradeId[] | null, upgrades: Upgrades): void {
    const key = options ? options.join(',') : '';
    if (key === this.shown.options) return;
    this.shown.options = key;
    this.cards.replaceChildren(
      ...(options ?? []).map((id, i) => {
        const def = UPGRADES[id];
        const next = (upgrades[id] ?? 0) + 1;
        const evolution = next >= EVOLVED_LEVEL ? def.evolution : undefined;
        const card = el('button', evolution ? 'card evolve' : def.owner ? 'card hero-ability' : `card ${def.kind}`);
        const header = el('div', 'card-header');
        header.append(el('span', 'key', String(i + 1)), el('span', 'card-name', evolution?.name ?? def.name));
        const max = upgradeMax(id);
        const tag = evolution ? 'EVOLVE' : next === 1 ? 'NEW' : next === max ? 'MAX' : `Lv ${next}`;
        header.append(el('span', 'tag', tag));
        const text = evolution ? `${def.name} evolves: ${evolution.text}` : def.describe(next);
        card.append(header, el('p', 'card-desc', text), pips(next, evolution ? MAX_LEVEL : max));
        card.addEventListener('click', () => this.onChoose(i));
        return card;
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
      : `Your team survived ${formatTime(result.time)} and reached level ${result.level}`;
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
