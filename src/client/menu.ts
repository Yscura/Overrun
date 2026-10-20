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

export type Screen = 'name' | 'home' | 'multiplayer' | 'profile' | 'shop' | 'settings' | 'bestiary';
/** The profile page's tabs. */
type ProfileTab = 'heroes' | 'artifacts' | 'prestige';

const NAME_KEY = 'overrun.name';
/** The token that keeps this browser logged in (see accounts.ts on the server). */
const TOKEN_KEY = 'overrun.token';
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
  /** Log in with a name and password (or create the account), log back in with a saved token, or log out. */
  onLogin: (name: string, password: string) => void = () => {};
  onResume: (name: string, token: string) => void = () => {};
  onLogout: (token: string) => void = () => {};
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
    shop: $('screen-shop'),
    settings: $('screen-settings'),
    bestiary: $('screen-bestiary'),
  };
  private profile: ProfileState | null = null;
  /** The artifacts in the combine slots (an id repeats if you put in several of it). */
  private forgeSlots: ArtifactId[] = [];
  /** Combining: the tier being combined (the artifacts tab shows only the slots and that tier), or null while browsing. */
  private combineTier: Tier | null = null;
  /** Browsing: the artifact clicked (its Equip and Combine buttons show). */
  private selectedArtifact: ArtifactId | null = null;
  /** The hero picked in the Shop, and its tab that's open. */
  private shopHero: CharacterId | null = null;
  private shopTab: 'heroes' | 'wheel' = 'heroes';
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
    const passwordInput = $<HTMLInputElement>('password');
    nameInput.value = this.name;
    $('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return nameInput.focus();
      if (!passwordInput.value) return passwordInput.focus();
      this.loginMessage('Logging in…');
      this.onLogin(name, passwordInput.value);
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
    $('open-shop').addEventListener('click', () => this.show('shop'));
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
    for (const tab of document.querySelectorAll<HTMLElement>('#screen-profile .profile-tab')) {
      tab.addEventListener('click', () => this.showProfileTab(tab.dataset.tab as ProfileTab));
    }
    for (const tab of document.querySelectorAll<HTMLElement>('#screen-shop .profile-tab')) {
      tab.addEventListener('click', () => this.showShopTab(tab.dataset.tab as 'heroes' | 'wheel'));
    }
    this.showShopTab(this.shopTab);
    this.showProfileTab(this.profileTab);
    this.buildWheel();
    $('forge-go').addEventListener('click', () => this.combine());
    $('forge-orb').addEventListener('click', () => this.combine());
    $('combine-cancel').addEventListener('click', () => {
      if (this.combining) return;
      this.leaveCombine();
    });
    $('wheel-spin').addEventListener('click', () => this.spin());

    $('logout').addEventListener('click', () => {
      this.onLogout(load(TOKEN_KEY) ?? '');
      save(TOKEN_KEY, '');
      passwordInput.value = '';
      this.loginMessage('Logged out.');
      this.show('name');
    });
    $<HTMLInputElement>('settings-volume').addEventListener('input', (e) => this.sound?.setVolume(Number((e.target as HTMLInputElement).value) / 100));
    $<HTMLInputElement>('settings-sfx').addEventListener('input', (e) => this.sound?.setSfxVolume(Number((e.target as HTMLInputElement).value) / 100));
    $<HTMLInputElement>('settings-music').addEventListener('input', (e) => this.sound?.setMusicVolume(Number((e.target as HTMLInputElement).value) / 100));
    $<HTMLInputElement>('settings-mute').addEventListener('change', (e) => this.sound?.setMuted((e.target as HTMLInputElement).checked));
  }

  bindSound(sound: Sound): void {
    this.sound = sound;
  }

  /** A line under the login form (how it went, or what to do). */
  private loginMessage(text: string, error = false): void {
    const line = $('login-message');
    line.textContent = text;
    line.classList.toggle('error', error);
  }

  /** The server's answer to logging in: home on success (staying logged in on this browser), else why not. */
  authResult(result: { ok: true; name: string; token: string; created: boolean } | { ok: false; message: string }): void {
    if (!result.ok) {
      save(TOKEN_KEY, '');
      this.show('name');
      this.loginMessage(result.message, true);
      return;
    }
    this.name = result.name;
    save(NAME_KEY, result.name);
    save(TOKEN_KEY, result.token);
    $<HTMLInputElement>('password').value = '';
    $('profile-card-name').textContent = result.name;
    this.show('home');
    if (result.created) this.setStatus(`Welcome, ${result.name}! Your account is made: log in with this name and password from now on.`);
  }

  /** Where to start: logged back in if this browser was, otherwise the login screen. */
  start(): void {
    $('profile-card-name').textContent = this.name;
    const token = load(TOKEN_KEY);
    this.show('name');
    if (this.name && token) {
      this.loginMessage('Logging in…');
      this.onResume(this.name, token);
    }
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
    $('profile-card').classList.toggle('hidden', overRoom || screen === 'name' || screen === 'profile' || screen === 'shop');
    this.overlay.querySelector('.menu-panel')!.classList.toggle('wide', screen === 'bestiary' || screen === 'profile' || screen === 'shop');
    if (screen === 'bestiary') this.renderBestiary();
    // (No logging out from inside a lobby: the button is only there in the menu.)
    $('logout').classList.toggle('hidden', overRoom);
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
    this.switchTab('#screen-profile', tab);
  }

  /** The Shop's tabs: heroes, or the artifact wheel. */
  private showShopTab(tab: 'heroes' | 'wheel'): void {
    this.shopTab = tab;
    this.switchTab('#screen-shop', tab);
  }

  /** Shows one tab (and its panel) of a screen's tabs. */
  private switchTab(screen: string, tab: string): void {
    for (const t of document.querySelectorAll<HTMLElement>(`${screen} .profile-tab`)) {
      t.classList.toggle('active', t.dataset.tab === tab);
      t.setAttribute('aria-selected', String(t.dataset.tab === tab));
    }
    for (const p of document.querySelectorAll<HTMLElement>(`${screen} .profile-panel`)) p.classList.toggle('hidden', p.dataset.panel !== tab);
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
    this.renderHeroes(profile, 'profile');
    this.renderHeroes(profile, 'shop');
    this.renderWheel(profile);
    $('shop-gold').textContent = `${profile.gold} gold`;
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

  /**
   * The artifacts tab, one of two ways. Browsing: your inventory; click an artifact for its Equip and Combine buttons.
   * Combining (after Combine): only the combine slots, and the artifacts of that tier you can put in them.
   */
  private renderArtifacts(profile: ProfileState): void {
    // Slots can't hold more than you have (after combining, or if something changed elsewhere).
    const kept: ArtifactId[] = [];
    for (const id of this.forgeSlots) if (kept.filter((k) => k === id).length < (profile.inventory[id] ?? 0)) kept.push(id);
    this.forgeSlots = kept;
    const items = this.freeCounts(profile);
    $('artifact-found').textContent = String(items.reduce((sum, i) => sum + i.total, 0) || '');
    const combining = this.combineTier !== null;
    $('artifact-browse').classList.toggle('hidden', combining);
    $('artifact-combine').classList.toggle('hidden', !combining);
    if (combining) {
      this.renderForge();
      this.renderCombineList(items);
      return;
    }

    const inventory = $('artifact-inventory');
    if (items.length === 0) {
      inventory.replaceChildren(el('p', 'inventory-empty', 'No artifacts yet. Elites, warlords and final bosses drop them, or try your luck on the wheel in the Shop.'));
      return;
    }
    if (this.selectedArtifact && !items.some((i) => i.id === this.selectedArtifact)) this.selectedArtifact = null;
    inventory.replaceChildren(
      ...items.map(({ id, total }) => {
        const def = ARTIFACTS[id];
        const equipped = profile.equipped === id;
        const selected = this.selectedArtifact === id;
        const card = this.artifactCard(id, total, `${equipped ? ' equipped' : ''}${selected ? ' selected' : ''}`);
        if (equipped) card.querySelector('.artifact-card-names')!.append(el('span', 'artifact-equipped-tag', 'Equipped'));
        card.title = selected ? '' : 'Click to equip or combine it';
        if (selected) {
          // Its two buttons: take it into your runs (or out), or combine it with others of its tier.
          const actions = el('div', 'artifact-actions');
          const equip = el('button', equipped ? 'secondary' : 'primary', equipped ? 'Unequip' : 'Equip') as HTMLButtonElement;
          equip.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onEquip(equipped ? null : id);
          });
          const next = nextTier(def.tier);
          const combine = el('button', 'secondary', 'Combine') as HTMLButtonElement;
          combine.disabled = !next;
          combine.title = next ? `${FORGE.count} ${TIERS[def.tier].name.toLowerCase()} artifacts become one random ${TIERS[next].name.toLowerCase()}` : 'Legendary is the top tier';
          combine.addEventListener('click', (e) => {
            e.stopPropagation();
            this.enterCombine(id);
          });
          actions.append(equip, combine);
          card.append(actions);
        }
        card.addEventListener('click', () => {
          this.selectedArtifact = selected ? null : id;
          this.renderArtifacts(profile);
        });
        return card;
      }),
    );
  }

  /** An artifact's card: its icon (with a count), name and tier, effects and flavor. */
  private artifactCard(id: ArtifactId, count: number, classes: string): HTMLElement {
    const def = ARTIFACTS[id];
    const card = el('div', `artifact-card${classes}`);
    const head = el('div', 'artifact-card-head');
    const names = el('div', 'artifact-card-names');
    names.append(el('div', 'artifact-name', def.name), tierTag(def.tier));
    const icon = el('div', 'artifact-card-icon');
    icon.append(artifactIcon(id, 44));
    if (count !== 1) icon.append(el('span', 'artifact-count', `×${count}`));
    head.append(icon, names);
    card.append(head, effectLines(id), el('p', 'artifact-flavor', def.flavor));
    return card;
  }

  /** Combine: the artifacts tab shows only the slots (this one in the first) and the others of its tier. */
  private enterCombine(id: ArtifactId): void {
    this.combineTier = ARTIFACTS[id].tier;
    this.forgeSlots = [id];
    this.selectedArtifact = null;
    if (this.profile) this.renderArtifacts(this.profile);
  }

  /** Back to browsing, the slots emptied. */
  private leaveCombine(): void {
    this.combineTier = null;
    this.forgeSlots = [];
    if (this.profile) this.renderArtifacts(this.profile);
  }

  /** Combining: the artifacts of the tier being combined that you still have free; click one to put it in a slot. */
  private renderCombineList(items: { id: ArtifactId; total: number; free: number }[]): void {
    const tier = this.combineTier!;
    $('combine-list-title').textContent = `Your ${TIERS[tier].name.toLowerCase()} artifacts`;
    const list = items.filter((i) => ARTIFACTS[i.id].tier === tier && i.free > 0);
    const full = this.forgeSlots.length >= FORGE.count;
    const box = $('combine-inventory');
    if (list.length === 0) {
      box.replaceChildren(el('p', 'inventory-empty', `No more ${TIERS[tier].name.toLowerCase()} artifacts to add.`));
      return;
    }
    box.replaceChildren(
      ...list.map(({ id, free }) => {
        const card = this.artifactCard(id, free, full ? ' no-fit' : ' fits');
        card.title = full ? 'The slots are full' : 'Click to put it in a slot';
        card.addEventListener('click', () => {
          if (full || this.combining) return;
          this.forgeSlots.push(id);
          if (this.profile) this.renderArtifacts(this.profile);
        });
        return card;
      }),
    );
  }

  /** The orb (the next tier's color once there's something in the slots) and the five slots under it. */
  private renderForge(): void {
    const tier = this.forgeTier() ?? this.combineTier;
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
        this.combineTier = null;
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

  /** What you just got, big, over everything (from combining in the profile, or the wheel in the Shop). */
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

  /**
   * Hero cards and the picked hero beside them. In the profile: the heroes you own, with each one's kit and your
   * record. In the Shop: every hero, with their price, and the picked one's kit and an Unlock button.
   */
  private renderHeroes(profile: ProfileState, where: 'profile' | 'shop'): void {
    const shop = where === 'shop';
    const owned = (id: CharacterId) => heroAvailable(id, profile.heroes);
    const ids = shop ? CHARACTER_IDS : CHARACTER_IDS.filter(owned);
    const wanted = shop ? this.shopHero : this.profileHero;
    const selected = wanted && ids.includes(wanted) ? wanted : profile.favorite && ids.includes(profile.favorite) ? profile.favorite : ids[0];
    $(shop ? 'shop-heroes' : 'hero-shop').replaceChildren(
      ...ids.map((id: CharacterId) => {
        const c = CHARACTERS[id];
        const have = owned(id);
        const runs = profile.records[id]?.runs ?? 0;
        // (The Shop grays out the heroes you own; elsewhere, the ones you don't. A secret hero stays dark until earned.)
        const dim = shop ? (have ? ' owned' : c.secret ? ' locked' : '') : have ? '' : ' locked';
        const card = el('button', `hero-tile${id === selected ? ' selected' : ''}${dim}`);
        // A secret hero stays a mystery until it's earned.
        if (!have && c.secret) card.append(mystery('hero-tile-portrait'), el('div', 'hero-tile-name', '???'), el('div', 'hero-tile-title', '???'));
        else card.append(heroPortrait(id, 0x4fc3f7, 'hero-tile-portrait'), el('div', 'hero-tile-name', c.name), el('div', 'hero-tile-title', c.title));
        card.append(el('div', 'hero-tile-runs', !have ? '' : shop ? (c.unlockCost !== undefined ? 'Owned' : 'Starter') : `${runs} run${runs === 1 ? '' : 's'}`));
        if (!have) card.append(el('span', 'hero-tile-lock', c.secret ? 'Locked' : `${c.unlockCost} gold`));
        card.addEventListener('click', () => {
          if (shop) this.shopHero = id;
          else this.profileHero = id;
          this.renderHeroes(profile, where);
        });
        return card;
      }),
    );

    // The picked hero: their kit, then (in the profile) how they've done for you, or (in the Shop) buying them.
    const panel = $(shop ? 'shop-hero' : 'profile-hero');
    if (!selected) {
      panel.replaceChildren();
      return;
    }
    const c = CHARACTERS[selected];
    const isOwned = owned(selected);
    const record = profile.records[selected];
    if (!isOwned && c.secret) {
      panel.replaceChildren(...mysteryDetail());
      return;
    }
    panel.replaceChildren(...heroDetail(selected, 0x4fc3f7));
    if (shop) {
      if (!isOwned) {
        const buy = el('button', 'primary hero-buy', `Unlock for ${c.unlockCost} gold`) as HTMLButtonElement;
        buy.disabled = profile.gold < c.unlockCost!;
        if (buy.disabled) buy.title = `You have ${profile.gold} gold`;
        buy.addEventListener('click', () => {
          if (window.confirm(`Buy ${c.name}, ${c.title} for ${c.unlockCost} gold?`)) this.onUnlock(selected);
        });
        panel.append(buy);
      } else {
        panel.append(el('p', 'shop-owned profile-owned', 'Owned'));
      }
      return;
    }
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
      panel.append(el('p', 'prestige-hint', 'No runs with this hero yet.'));
    }
  }
}
