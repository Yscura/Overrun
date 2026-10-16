// The main menu: your name, the home screen with the modes, multiplayer (create or join a lobby), your profile
// (prestige shop and heroes) and settings. Profile and settings can also be opened on top of a lobby.

import { ARTIFACTS, type ArtifactId } from '../shared/artifacts';
import { CHARACTERS, CHARACTER_IDS, heroAvailable, type CharacterId } from '../shared/characters';
import { MAPS } from '../shared/maps';
import { MODES, MODE_IDS, type ModeId } from '../shared/modes';
import { PRESTIGE, PRESTIGE_IDS, prestigeCost, type PrestigeId } from '../shared/prestige';
import type { ProfileState, RoomInfo } from '../shared/protocol';
import type { Sound } from './audio';
import { ALL_ARTIFACTS, artifactIcon, effectLines, tierTag } from './artifactView';
import { renderBestiary } from './bestiary';
import { heroDetail, heroPortrait, statGrid } from './heroView';
import { portraitHtml } from './portraits';

export type Screen = 'name' | 'home' | 'multiplayer' | 'profile' | 'settings' | 'bestiary';

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

    const settingsName = $<HTMLInputElement>('settings-name');
    $('settings-name-save').addEventListener('click', () => {
      const name = settingsName.value.trim();
      if (name && name !== this.name) {
        this.setName(name);
        this.setStatus(`You're now playing as ${name}.`);
      }
    });
    $<HTMLInputElement>('settings-volume').addEventListener('input', (e) => this.sound?.setVolume(Number((e.target as HTMLInputElement).value) / 100));
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

  // --- Profile: prestige shop and heroes ---

  setProfile(profile: ProfileState): void {
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
    this.renderPrestige(profile);
    this.renderArtifacts(profile);
    this.renderHeroShop(profile);
  }

  /** Every artifact in the game: the ones you own (click to equip), and the ones still to find. */
  private renderArtifacts(profile: ProfileState): void {
    $('artifact-found').textContent = `· ${profile.artifacts.length} / ${ALL_ARTIFACTS.length} found`;
    $('artifact-inventory').replaceChildren(
      ...ALL_ARTIFACTS.map((id) => {
        const def = ARTIFACTS[id];
        const owned = profile.artifacts.includes(id);
        const equipped = profile.equipped === id;
        const card = el('button', `artifact-card${owned ? '' : ' unknown'}${equipped ? ' equipped' : ''}`) as HTMLButtonElement;
        card.disabled = !owned;
        const head = el('div', 'artifact-card-head');
        const names = el('div', 'artifact-card-names');
        names.append(el('div', 'artifact-name', owned ? def.name : '???'), tierTag(def.tier));
        head.append(artifactIcon(id, 40, owned), names);
        if (equipped) head.append(el('span', 'artifact-equipped', 'Equipped'));
        card.append(head);
        if (owned) card.append(effectLines(id), el('p', 'artifact-flavor', def.flavor));
        else card.append(el('p', 'artifact-flavor', 'Not found yet.'));
        if (owned) {
          card.title = equipped ? 'Click to unequip' : 'Click to equip';
          card.addEventListener('click', () => this.onEquip(equipped ? null : id));
        }
        return card;
      }),
    );
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
        card.append(heroPortrait(id, 0x4fc3f7, 'hero-tile-portrait'), el('div', 'hero-tile-name', c.name), el('div', 'hero-tile-title', c.title));
        card.append(el('div', 'hero-tile-runs', owned ? `${runs} run${runs === 1 ? '' : 's'}` : ''));
        if (!owned) card.append(el('span', 'hero-tile-lock', `${c.unlockCost} gold`));
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
    if (!owned) {
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
