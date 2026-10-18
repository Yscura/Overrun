// The main menu: your name, the home screen with the modes, multiplayer (create or join a lobby), your profile
// (prestige shop and heroes) and settings. Profile and settings can also be opened on top of a lobby.

import { ARTIFACTS, FORGE, TIERS, TIER_IDS, WHEEL, nextTier, type ArtifactId, type Tier } from '../shared/artifacts';
import { CHARACTERS, CHARACTER_IDS, heroAvailable, type CharacterId } from '../shared/characters';
import { MAPS } from '../shared/maps';
import { MODES, MODE_IDS, type ModeId } from '../shared/modes';
import { PRESTIGE, PRESTIGE_IDS, prestigeCost, type PrestigeId } from '../shared/prestige';
import type { ProfileState, RoomInfo } from '../shared/protocol';
import type { Sound } from './audio';
import { artifactIcon, effectLines, sortArtifacts, tierColor, tierTag } from './artifactView';
import { renderBestiary } from './bestiary';
import { heroDetail, heroPortrait, mystery, mysteryDetail, statGrid } from './heroView';
import { portraitHtml } from './portraits';

export type Screen = 'name' | 'home' | 'multiplayer' | 'profile' | 'settings' | 'bestiary';
/** The profile page's tabs. */
type ProfileTab = 'heroes' | 'artifacts' | 'prestige';

const NAME_KEY = 'overrun.name';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not important if this fails.
  }
}

export class Menu {
  /** You've told us your name (first time, or changed in settings). */
  onName: (name: string) => void = () => {};
  /** Start a mode that goes straight into its own room (singleplayer). */
  onPlay: (mode: ModeId) => void = () => {};
  onCreateLobby: () => void = () => {};
  onJoin: (code: string) => void = () => {};
  onRefreshRooms: () => void = () => {};
  onOpenProfile: () => void = () => {};
  onPrestige: (id: PrestigeId) => void = () => {};
  onRespec: () => void = () => {};
  onUnlock: (character: CharacterId) => void = () => {};
  /** Take an artifact into your runs (null: none). */
  onEquip: (artifact: ArtifactId | null) => void = () => {};
  /** Combine these artifacts (FORGE.count of one tier) into one of the next tier. */
  onCombine: (artifacts: ArtifactId[]) => void = () => {};
  /** Spin the artifact wheel. */
  onSpin: () => void = () => {};

  private overlay = $('menu');
  private status = $('menu-status');
  private screens: Record<Screen, HTMLElement> = {
    name: $('screen-name'),
    home: $('screen-home'),
    multiplayer: $('screen-multiplayer'),
    profile: $('screen-profile'),
    settings: $('screen-settings'),
    bestiary: $('screen-bestiary'),
  };
  private profile: ProfileState | null = null;
  /** The artifacts in the combine slots (an id repeats if you put in several of it). */
  private forgeSlots: ArtifactId[] = [];
  /** Waiting on the server's answer to Combine. */
  private combining = false;
  /** The wheel's rotation in degrees, its tier segments, and whether it's spinning (profile updates wait until it stops). */
  private wheelAngle = 0;
  private wheelSegments: { tier: Tier; from: number; to: number }[] = [];
  private spinning = false;
  private pendingProfile: ProfileState | null = null;
  /** The profile tab that's open (the last one you looked at). */
  private profileTab: ProfileTab = 'heroes';
  /** The hero shown on the profile page (your favorite until you pick another). */
  private profileHero: CharacterId | null = null;
  /** An enemy's picture, from the game's sprites (set by main once the renderer is up). */
  enemyArt: (type: number, color?: number) => string = () => '';
  /** Opened on top of a lobby: Back closes the menu instead of going home. */
  private overRoom = false;
  private roomsTimer = 0;
  private sound: Sound | null = null;
  name = load(NAME_KEY)?.trim() ?? '';

  constructor() {
    const nameInput = $<HTMLInputElement>('name');
    nameInput.value = this.name;
    const submitName = () => {
      const name = nameInput.value.trim();
      if (!name) return nameInput.focus();
      this.setName(name);
      this.show('home');
    };
    $('name-ok').addEventListener('click', submitName);
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitName();
    });

    // The modes, one button each. Modes with a lobby browser open the multiplayer screen.
    $('mode-list').replaceChildren(
      ...MODE_IDS.map((id) => {
        const mode = MODES[id];
        const button = el('button', 'mode-button');
        button.append(el('span', 'mode-name', mode.name), el('span', 'mode-desc', mode.description));
        button.addEventListener('click', () => (mode.joinable ? this.show('multiplayer') : this.onPlay(id)));
        return button;
      }),
    );
    $('profile-card').addEventListener('click', () => this.show('profile'));
    $('open-bestiary').addEventListener('click', () => this.show('bestiary'));
    $('open-settings').addEventListener('click', () => this.show('settings'));
    for (const back of document.querySelectorAll<HTMLElement>('#menu [data-back]')) back.addEventListener('click', () => this.back());

    $('create-lobby').addEventListener('click', () => this.onCreateLobby());
    const codeInput = $<HTMLInputElement>('join-code');
    const joinByCode = () => {
      const code = codeInput.value.trim().toUpperCase();
      if (code.length === 4) this.onJoin(code);
      else this.setStatus('Lobby codes are 4 letters.');
    };
    $('join-by-code').addEventListener('click', joinByCode);
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') joinByCode();
    });
    codeInput.addEventListener('input', () => (codeInput.value = codeInput.value.toUpperCase()));

    $('respec').addEventListener('click', () => this.onRespec());
    for (const tab of document.querySelectorAll<HTMLElement>('.profile-tab')) {
      tab.addEventListener('click', () => this.showProfileTab(tab.dataset.tab as ProfileTab));
    }
    this.showProfileTab(this.profileTab);
    this.buildWheel();
    $('forge-go').addEventListener('click', () => this.combine());
    $('forge-orb').addEventListener('click', () => this.combine());
    $('wheel-spin').addEventListener('click', () => this.spin());

    const settingsName = $<HTMLInputElement>('settings-name');
    $('settings-name-save').addEventListener('click', () => {
      const name = settingsName.value.trim();
      if (name && name !== this.name) {
        this.setName(name);
        this.setStatus(`You're now playing as ${name}.`);
      }
    });
    $<HTMLInputElement>('settings-volume').addEventListener('input', (e) => this.sound?.setVolume(Number((e.target as HTMLInputElement).value) / 100));
    $<HTMLInputElement>('settings-sfx').addEventListener('input', (e) => this.sound?.setSfxVolume(Number((e.target as HTMLInputElement).value) / 100));
    $<HTMLInputElement>('settings-music').addEventListener('input', (e) => this.sound?.setMusicVolume(Number((e.target as HTMLInputElement).value) / 100));
    $<HTMLInputElement>('settings-mute').addEventListener('change', (e) => this.sound?.setMuted((e.target as HTMLInputElement).checked));
  }

  bindSound(sound: Sound): void {
    this.sound = sound;
  }

  private setName(name: string): void {
    this.name = name;
    save(NAME_KEY, name);
    $('profile-card-name').textContent = name;
    this.onName(name);
  }

  /** Where to start: the name screen the first time, otherwise home. */
  start(): void {
    $('profile-card-name').textContent = this.name;
    this.show(this.name ? 'home' : 'name');
    if (this.name) this.onName(this.name);
  }

  get isOpen(): boolean {
    return !this.overlay.classList.contains('hidden');
  }

  show(screen: Screen, overRoom = false): void {
    this.overRoom = overRoom;
    this.overlay.classList.remove('hidden');
    this.overlay.classList.toggle('over-room', overRoom);
    for (const [id, node] of Object.entries(this.screens)) node.classList.toggle('hidden', id !== screen);
    // The profile card sits in the corner of the menu screens (not over a lobby, and not on your own profile).
    $('profile-card').classList.toggle('hidden', overRoom || screen === 'name' || screen === 'profile');
    this.overlay.querySelector('.menu-panel')!.classList.toggle('wide', screen === 'bestiary' || screen === 'profile');
    if (screen === 'bestiary') this.renderBestiary();
    this.setStatus('');
    clearInterval(this.roomsTimer);
    if (screen === 'multiplayer') {
      // Keep the lobby list fresh while it's open.
      this.onRefreshRooms();
      this.roomsTimer = window.setInterval(() => this.onRefreshRooms(), 2000);
    }
    if (screen === 'profile') {
      this.onOpenProfile();
      // Your progress is saved under your name, so it can't change mid-game.
      $<HTMLInputElement>('settings-name').value = this.name;
      $<HTMLInputElement>('settings-name').disabled = overRoom;
      $('settings-name-save').toggleAttribute('disabled', overRoom);
    }
    if (screen === 'settings') {
      $<HTMLInputElement>('settings-volume').value = String(Math.round((this.sound?.getVolume() ?? 1) * 100));
      $<HTMLInputElement>('settings-mute').checked = this.sound?.isMuted() ?? false;
      $<HTMLInputElement>('settings-sfx').value = String(Math.round((this.sound?.getSfxVolume() ?? 1) * 100));
      $<HTMLInputElement>('settings-music').value = String(Math.round((this.sound?.getMusicVolume() ?? 0.5) * 100));
    }
    if (screen === 'name') $<HTMLInputElement>('name').focus();
  }

  hide(): void {
    clearInterval(this.roomsTimer);
    this.overlay.classList.add('hidden');
  }

  private back(): void {
    if (this.overRoom) this.hide();
    else this.show('home');
  }

  setStatus(text: string): void {
    this.status.textContent = text;
  }

  // --- Multiplayer: the lobby browser ---

  setRooms(rooms: RoomInfo[]): void {
    const list = $('lobby-list');
    if (rooms.length === 0) {
      list.replaceChildren(el('li', 'lobby-empty', 'No open lobbies right now. Create one and share its code!'));
      return;
    }
    list.replaceChildren(
      ...rooms.map((r) => {
        const li = el('li', 'lobby-row');
        const info = el('div', 'lobby-info');
        info.append(
          el('div', 'lobby-host', `${r.host}'s lobby`),
          el('div', 'lobby-meta', `${MAPS[r.map].name} · ${r.players} / 4 players · ${r.phase === 'lobby' ? 'in the lobby' : 'playing'}`),
        );
        const join = el('button', 'secondary', 'Join') as HTMLButtonElement;
        join.addEventListener('click', () => this.onJoin(r.code));
        li.append(el('span', 'lobby-code', r.code), info, join);
        return li;
      }),
    );
  }

  // --- Profile: heroes, artifacts and the prestige shop, one tab each ---

  private showProfileTab(tab: ProfileTab): void {
    this.profileTab = tab;
    for (const t of document.querySelectorAll<HTMLElement>('.profile-tab')) {
      t.classList.toggle('active', t.dataset.tab === tab);
      t.setAttribute('aria-selected', String(t.dataset.tab === tab));
    }
    for (const p of document.querySelectorAll<HTMLElement>('.profile-panel')) p.classList.toggle('hidden', p.dataset.panel !== tab);
  }

  setProfile(profile: ProfileState): void {
    // Mid-spin, the new artifact would show up before the wheel stops: hold the update until it does.
    if (this.spinning) {
      this.pendingProfile = profile;
      return;
    }
    this.profile = profile;
    this.renderCard(profile);
    if (!this.screens.bestiary.classList.contains('hidden')) this.renderBestiary();
    $('profile-name').textContent = profile.name;
    // Totals across every hero, and what's in the wallet.
    const totals = statGrid(
      [
        ['Runs', String(profile.runs)],
        ['Wins', String(profile.wins)],
        ['Kills', profile.kills.toLocaleString('en-US')],
        ['Gold', String(profile.gold)],
        ['Prestige points', String(profile.points)],
      ],
      'hero-stats profile-total-stats',
    );
    totals.children[3].classList.add('gold');
    totals.children[4].classList.add('prestige');
    $('profile-totals').replaceChildren(totals);
    $('prestige-unspent').textContent = profile.points > 0 ? String(profile.points) : '';
    this.renderPrestige(profile);
    this.renderArtifacts(profile);
    this.renderHeroShop(profile);
  }

  // --- Artifacts: inventory, combining and the wheel ---

  /** Your artifacts with how many of each are still free (not in a combine slot), best first. */
  private freeCounts(profile: ProfileState): { id: ArtifactId; total: number; free: number }[] {
    const ids = sortArtifacts(Object.keys(profile.inventory) as ArtifactId[]);
    return ids.map((id) => {
      const total = profile.inventory[id] ?? 0;
      return { id, total, free: total - this.forgeSlots.filter((s) => s === id).length };
    });
  }

  /** The tier in the combine slots, if any. */
  private forgeTier(): Tier | null {
    return this.forgeSlots.length ? ARTIFACTS[this.forgeSlots[0]].tier : null;
  }

  private renderArtifacts(profile: ProfileState): void {
    // Slots can't hold more than you have (after combining, or if something changed elsewhere).
    const kept: ArtifactId[] = [];
    for (const id of this.forgeSlots) if (kept.filter((k) => k === id).length < (profile.inventory[id] ?? 0)) kept.push(id);
    this.forgeSlots = kept;
    const items = this.freeCounts(profile);
    $('artifact-found').textContent = String(items.reduce((sum, i) => sum + i.total, 0) || '');
    this.renderForge();
    this.renderWheel(profile);

    const tier = this.forgeTier();
    const inventory = $('artifact-inventory');
    if (items.length === 0) {
      inventory.replaceChildren(el('p', 'inventory-empty', 'No artifacts yet. Elites, warlords and final bosses drop them, or try your luck on the wheel.'));
      return;
    }
    inventory.replaceChildren(
      ...items.map(({ id, total, free }) => {
        const def = ARTIFACTS[id];
        const equipped = profile.equipped === id;
        // Can it go in a combine slot right now?
        const fits = free > 0 && nextTier(def.tier) !== null && this.forgeSlots.length < FORGE.count && (!tier || tier === def.tier);
        const card = el('div', `artifact-card${equipped ? ' equipped' : ''}${fits ? ' fits' : ' no-fit'}`);
        card.title = fits ? 'Click to put it in a combine slot' : nextTier(def.tier) ? '' : 'Legendary is the top tier';
        const head = el('div', 'artifact-card-head');
        const names = el('div', 'artifact-card-names');
        names.append(el('div', 'artifact-name', def.name), tierTag(def.tier));
        const icon = el('div', 'artifact-card-icon');
        icon.append(artifactIcon(id, 44));
        if (total > 1 || free !== total) icon.append(el('span', 'artifact-count', `×${free}`));
        head.append(icon, names);
        const equip = el('button', `artifact-equip${equipped ? ' on' : ''}`, equipped ? 'Equipped' : 'Equip') as HTMLButtonElement;
        equip.title = equipped ? 'Click to unequip' : 'Take it into your runs';
        equip.addEventListener('click', (e) => {
          e.stopPropagation();
          this.onEquip(equipped ? null : id);
        });
        head.append(equip);
        card.append(head, effectLines(id), el('p', 'artifact-flavor', def.flavor));
        card.addEventListener('click', () => {
          if (!fits || this.combining) return;
          this.forgeSlots.push(id);
          this.renderArtifacts(profile);
        });
        return card;
      }),
    );
  }

  /** The orb (the next tier's color once there's something in the slots) and the five slots under it. */
  private renderForge(): void {
    const tier = this.forgeTier();
    const next = tier ? nextTier(tier) : null;
    const orb = $('forge-orb');
    orb.style.setProperty('--tier', next ? tierColor(next) : '#5d6676');
    orb.classList.toggle('charged', this.forgeSlots.length === FORGE.count);
    const slots: HTMLElement[] = [];
    for (let i = 0; i < FORGE.count; i++) {
      const id = this.forgeSlots[i];
      const slot = el('button', `forge-slot${id ? ' filled' : ''}`) as HTMLButtonElement;
      slot.append(artifactIcon(id ?? null, 50));
      if (id) {
        slot.title = `${ARTIFACTS[id].name}: click to take it out`;
        slot.addEventListener('click', () => {
          if (this.combining) return;
          this.forgeSlots.splice(i, 1);
          if (this.profile) this.renderArtifacts(this.profile);
        });
      }
      slots.push(slot);
    }
    $('forge-slots').replaceChildren(...slots);
    const go = $<HTMLButtonElement>('forge-go');
    const n = this.forgeSlots.length;
    go.disabled = n < FORGE.count || this.combining;
    go.textContent = next && n === FORGE.count ? `Combine into ${TIERS[next].name}` : 'Combine';
    $('forge-hint').textContent = !tier
      ? `Put ${FORGE.count} artifacts of the same tier in the slots to turn them into a random one of the next tier.`
      : n < FORGE.count
        ? `${n} of ${FORGE.count} ${TIERS[tier].name.toLowerCase()}: add ${FORGE.count - n} more.`
        : `Ready: ${FORGE.count} ${TIERS[tier].name.toLowerCase()} become one random ${TIERS[next!].name.toLowerCase()}.`;
  }

  private combine(): void {
    if (this.forgeSlots.length !== FORGE.count || this.combining) return;
    this.combining = true;
    $('forge-orb').classList.add('forging');
    this.renderForge();
    this.onCombine([...this.forgeSlots]);
    // If the server says no (it shouldn't), don't stay stuck.
    window.setTimeout(() => this.endCombine(), 3000);
  }

  private endCombine(): void {
    if (!this.combining) return;
    this.combining = false;
    $('forge-orb').classList.remove('forging');
    if (this.profile) this.renderArtifacts(this.profile);
  }

  /** The wheel's face: each tier's slice sized by its odds, twice around. */
  private buildWheel(): void {
    const total = TIER_IDS.reduce((sum, t) => sum + WHEEL.weights[t], 0);
    const stops: string[] = [];
    let a = 0;
    for (let rep = 0; rep < 2; rep++) {
      for (const tier of TIER_IDS) {
        const size = (WHEEL.weights[tier] / total) * 180;
        stops.push(`${tierColor(tier)} ${a}deg ${a + size}deg`);
        this.wheelSegments.push({ tier, from: a, to: a + size });
        a += size;
      }
    }
    $('wheel').style.background = `conic-gradient(${stops.join(', ')})`;
    const odds = $('wheel-odds');
    odds.replaceChildren(
      ...TIER_IDS.map((tier) => {
        const chip = el('span', 'wheel-chance', `${TIERS[tier].name} ${Math.round((WHEEL.weights[tier] / total) * 100)}%`);
        chip.style.setProperty('--tier', tierColor(tier));
        return chip;
      }),
    );
  }

  private renderWheel(profile: ProfileState): void {
    const spin = $<HTMLButtonElement>('wheel-spin');
    spin.disabled = this.spinning || profile.gold < WHEEL.cost;
    spin.textContent = `Spin · ${WHEEL.cost} gold`;
    spin.title = profile.gold < WHEEL.cost ? `You have ${profile.gold} gold` : '';
  }

  private spin(): void {
    if (this.spinning || !this.profile || this.profile.gold < WHEEL.cost) return;
    this.spinning = true;
    $<HTMLButtonElement>('wheel-spin').disabled = true;
    this.onSpin();
    // If the server says no (it shouldn't), don't stay stuck.
    window.setTimeout(() => {
      if (this.spinning && !$('wheel').classList.contains('turning')) this.stopSpinning();
    }, 3000);
  }

  private stopSpinning(): void {
    this.spinning = false;
    $('wheel').classList.remove('turning');
    const profile = this.pendingProfile ?? this.profile;
    this.pendingProfile = null;
    if (profile) this.setProfile(profile);
  }

  /** The server's answer to Combine or Spin: turn the wheel onto the tier first, then show what you got. */
  showArtifactResult(id: ArtifactId, how: 'combine' | 'spin'): void {
    if (how === 'combine') {
      this.forgeSlots = [];
      window.setTimeout(() => {
        this.endCombine();
        this.reveal(id, 'Combined into');
      }, 700);
      return;
    }
    const tier = ARTIFACTS[id].tier;
    const options = this.wheelSegments.filter((s) => s.tier === tier);
    const seg = options[Math.floor(Math.random() * options.length)];
    // Somewhere inside the slice (not on its edge), under the pointer at the top.
    const at = seg.from + (seg.to - seg.from) * (0.2 + Math.random() * 0.6);
    const turn = (((-at - this.wheelAngle) % 360) + 360) % 360;
    this.wheelAngle += 360 * 5 + turn;
    const wheel = $('wheel');
    wheel.classList.add('turning');
    wheel.style.transform = `rotate(${this.wheelAngle}deg)`;
    window.setTimeout(() => {
      this.stopSpinning();
      this.reveal(id, 'The wheel gives you');
    }, 4300);
  }

  /** What you just got, big, over the combine and wheel stations. */
  private reveal(id: ArtifactId, label: string): void {
    const def = ARTIFACTS[id];
    const box = $('artifact-reveal');
    box.style.setProperty('--tier', tierColor(def.tier));
    const card = el('div', 'reveal-card');
    const ok = el('button', 'primary', 'Nice!') as HTMLButtonElement;
    ok.addEventListener('click', () => box.classList.add('hidden'));
    card.append(el('div', 'reveal-label', label), artifactIcon(id, 110), el('div', 'reveal-name', def.name), tierTag(def.tier), effectLines(id), ok);
    box.replaceChildren(card);
    box.classList.remove('hidden');
  }

  /** The corner card: your favorite hero's portrait, your name, and your gold and prestige. */
  private renderCard(profile: ProfileState): void {
    const hero = profile.favorite;
    $('profile-card-portrait').innerHTML = hero ? portraitHtml(hero, 0x4fc3f7) : '<span class="profile-card-empty">?</span>'; // Bundled image or static text.
    $('profile-card-name').textContent = profile.name;
    $('profile-card-hero').textContent = hero
      ? `${CHARACTERS[hero].name}, ${CHARACTERS[hero].title} · ${profile.runs} run${profile.runs === 1 ? '' : 's'}`
      : 'No runs yet';
    $('profile-card-wallet').textContent = `${profile.gold} gold · ${profile.points} prestige`;
  }

  private renderBestiary(): void {
    $('bestiary').replaceChildren(renderBestiary(this.profile?.bosses ?? [], this.enemyArt));
  }

  private renderPrestige(profile: ProfileState): void {
    $('prestige').replaceChildren(
      ...PRESTIGE_IDS.map((id) => {
        const def = PRESTIGE[id];
        const rank = profile.ranks[id] ?? 0;
        const maxed = rank >= def.maxRank;
        const cost = prestigeCost(rank);
        const row = el('div', 'prestige-row');
        const info = el('div', 'prestige-info');
        info.append(el('div', 'prestige-name', def.name), el('div', 'prestige-desc', rank > 0 ? def.describe(rank) : `${def.describe(1)} per rank`));
        const pips = el('div', 'pips');
        for (let i = 0; i < def.maxRank; i++) pips.append(el('span', i < rank ? 'pip on' : 'pip'));
        const buy = el('button', 'prestige-buy', maxed ? 'Max' : `+1 · ${cost}`) as HTMLButtonElement;
        buy.disabled = maxed || profile.points < cost;
        buy.title = maxed ? '' : `Rank ${rank + 1}: ${def.describe(rank + 1)}`;
        buy.addEventListener('click', () => this.onPrestige(id));
        row.append(info, pips, buy);
        return row;
      }),
    );
  }

  /** Hero cards (portrait, name, runs or price) and the selected hero's kit and record beside them. */
  private renderHeroShop(profile: ProfileState): void {
    const selected = this.profileHero ?? profile.favorite ?? CHARACTER_IDS[0];
    $('hero-shop').replaceChildren(
      ...CHARACTER_IDS.map((id: CharacterId) => {
        const c = CHARACTERS[id];
        const owned = heroAvailable(id, profile.heroes);
        const runs = profile.records[id]?.runs ?? 0;
        const card = el('button', `hero-tile${id === selected ? ' selected' : ''}${owned ? '' : ' locked'}`);
        // A secret hero stays a mystery until it's earned.
        if (!owned && c.secret) card.append(mystery('hero-tile-portrait'), el('div', 'hero-tile-name', '???'), el('div', 'hero-tile-title', '???'));
        else card.append(heroPortrait(id, 0x4fc3f7, 'hero-tile-portrait'), el('div', 'hero-tile-name', c.name), el('div', 'hero-tile-title', c.title));
        card.append(el('div', 'hero-tile-runs', owned ? `${runs} run${runs === 1 ? '' : 's'}` : ''));
        if (!owned) card.append(el('span', 'hero-tile-lock', c.secret ? 'Locked' : `${c.unlockCost} gold`));
        card.addEventListener('click', () => {
          this.profileHero = id;
          this.renderHeroShop(profile);
        });
        return card;
      }),
    );

    // The selected hero: their kit, then how they've done for you, then buying them if you haven't.
    const c = CHARACTERS[selected];
    const owned = heroAvailable(selected, profile.heroes);
    const record = profile.records[selected];
    const panel = $('profile-hero');
    if (!owned && c.secret) {
      panel.replaceChildren(...mysteryDetail());
      return;
    }
    panel.replaceChildren(...heroDetail(selected, 0x4fc3f7));
    panel.append(el('h2', 'profile-record-title', 'Your record'));
    if (record && record.runs > 0) {
      const minutes = Math.floor(record.bestTime / 60);
      const seconds = String(record.bestTime % 60).padStart(2, '0');
      panel.append(
        statGrid(
          [
            ['Runs', String(record.runs)],
            ['Wins', String(record.wins)],
            ['Kills', record.kills.toLocaleString('en-US')],
            ['Best damage', record.bestDamage.toLocaleString('en-US')],
            ['Longest run', `${minutes}:${seconds}`],
            ['Win rate', `${Math.round((record.wins / record.runs) * 100)}%`],
          ],
          'hero-stats profile-record',
        ),
      );
    } else {
      panel.append(el('p', 'prestige-hint', owned ? 'No runs with this hero yet.' : 'Unlock this hero to start a record.'));
    }
    if (!owned && c.secret) {
      panel.append(el('p', 'prestige-hint', 'Play more to unlock.'));
    } else if (!owned) {
      const buy = el('button', 'primary hero-buy', `Unlock for ${c.unlockCost} gold`) as HTMLButtonElement;
      buy.disabled = profile.gold < c.unlockCost!;
      if (buy.disabled) buy.title = `You have ${profile.gold} gold`;
      buy.addEventListener('click', () => {
        if (window.confirm(`Buy ${c.name}, ${c.title} for ${c.unlockCost} gold?`)) this.onUnlock(selected);
      });
      panel.append(buy);
    } else if (c.unlockCost !== undefined) {
      panel.append(el('p', 'shop-owned profile-owned', 'Owned'));
    }
  }
}
