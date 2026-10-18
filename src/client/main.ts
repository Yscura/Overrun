import { SUMMON_STRIDE, SummonKind, isDevName } from '../shared/protocol';
import { CHARACTERS, DEFAULT_CHARACTER, isCharacterId } from '../shared/characters';
import { WallIndex, moveCircle, overlapsWall, type PassFlags } from '../shared/collision';
import { DODGE_DURATION, DODGE_SPEED, DRAGON_INTRO, PLAYER_RADIUS, TICK_RATE } from '../shared/constants';
import { MAPS, clampToArena, mapWalls } from '../shared/maps';
import type { Snapshot } from '../shared/protocol';
import { Sound } from './audio';
import { Input } from './input';
import { Connection } from './net';
import { GameRenderer } from './renderer';
import { SnapshotBuffer } from './snapshots';
import { SoundCues } from './soundCues';
import { Chat } from './chat';
import { Menu } from './menu';
import { Music } from './music';
import { UI, formatTime } from './ui';
import './style.css';

/** Is a Spirit Bear out? (Summons don't say whose, which only matters with two druids.) */
function hasBear(summons: number[]): boolean {
  for (let i = 0; i < summons.length; i += SUMMON_STRIDE) if (summons[i + 1] === SummonKind.Bear) return true;
  return false;
}

/** The hero you last picked (the lobby remembers it). */
function loadHero(): string | null {
  try {
    return localStorage.getItem('overrun.character');
  } catch {
    return null;
  }
}

/** A dash that ends inside a wall keeps going this much longer to come out the other side. */
const MAX_DASH_EXTENSION = 0.15;

async function main() {
  const renderer = new GameRenderer();
  await renderer.init(document.getElementById('app')!);

  const ui = new UI();
  const input = new Input();
  const net = new Connection();
  const buffer = new SnapshotBuffer();
  const sound = new Sound();
  const cues = new SoundCues(sound);
  cues.onDuck = (seconds) => music.duck(seconds);
  const music = new Music(sound);
  ui.bindSound(sound);
  renderer.onEnemyDeath = (x, y, big) => sound.play(big ? 'explode' : 'death', { x, y }, local);

  let myId: number | null = null;
  let latest: Snapshot | null = null;
  /** The music stays quiet until then (Mordak's entrance). */
  let silentUntil = 0;
  // Your own position is simulated locally so movement feels instant; the server just follows along.
  const local = { ...MAPS[0].spawn };
  let walls = new WallIndex(mapWalls(MAPS[0], true), MAPS[0].width, MAPS[0].height);
  /** Which map, and whether its arena gate is open, the walls were built for. */
  let wallsFor = '0:shut';
  let epoch = -1;
  let sendTimer = 0;
  let lastSent = { x: NaN, y: NaN, aim: NaN };
  // Dodge dash in progress, and the cooldown until the next one.
  let dodgeTime = 0;
  let dashExtension = 0;
  let dodgeDir = { x: 0, y: 0 };
  let dodgeCooldown = 0;

  // --- The main menu ---
  const menu = new Menu();
  menu.bindSound(sound);
  menu.enemyArt = (type, color) => renderer.enemyArt(type, color);
  const savedHero = () => {
    const saved = loadHero();
    return isCharacterId(saved) ? saved : DEFAULT_CHARACTER;
  };
  menu.onName = (name) => net.send({ t: 'hello', name });
  menu.onPlay = (mode) => net.send({ t: 'create', mode, character: savedHero() });
  menu.onCreateLobby = () => net.send({ t: 'create', mode: 'multi', character: savedHero() });
  menu.onJoin = (code) => net.send({ t: 'join', code, character: savedHero() });
  menu.onRefreshRooms = () => net.send({ t: 'rooms' });
  menu.onOpenProfile = () => net.send({ t: 'profile' });
  menu.onPrestige = (id) => net.send({ t: 'prestige', id });
  menu.onRespec = () => net.send({ t: 'respec' });
  menu.onUnlock = (character) => net.send({ t: 'unlock', character });
  menu.onEquip = (artifact) => net.send({ t: 'equip', artifact });
  menu.onCombine = (artifacts) => net.send({ t: 'combine', artifacts });
  menu.onSpin = () => net.send({ t: 'spin' });

  // --- Chat and event log ---
  const chat = new Chat();
  chat.onSend = (text) => net.send({ t: 'chat', text });
  // Enter opens the chat (while you're in a room and no menu or text field has the keyboard).
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.repeat || myId === null || menu.isOpen || chat.typing) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    e.preventDefault(); // Don't also press a focused button.
    input.release();
    chat.open();
  });
  /** Run time during a run, otherwise the clock. */
  const stamp = () =>
    latest?.phase === 'playing' ? formatTime(latest.time) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  // Shift-click the map or the minimap: ping that spot for the whole team.
  renderer.app.canvas.addEventListener('pointerdown', (e) => {
    if (!e.shiftKey || e.button !== 0 || latest?.phase !== 'playing' || myId === null) return;
    const at = renderer.screenToWorld(e.clientX, e.clientY);
    net.send({ t: 'ping', x: Math.round(at.x), y: Math.round(at.y) });
  });

  // --- In a room ---
  ui.onPick = (character) => net.send({ t: 'pick', character });
  ui.onPickMap = (index, mode) => net.send({ t: 'map', index, mode });
  ui.onStart = () => net.send({ t: 'start' });
  ui.onLobby = () => net.send({ t: 'lobby' });
  ui.onChoose = (index) => net.send({ t: 'choose', index });
  ui.onOpenProfile = () => menu.show('profile', true);
  ui.onLeave = () => net.send({ t: 'leave' });
  ui.onShare = (text) => net.send({ t: 'chat', text });
  ui.onDev = (action) => net.send({ t: 'dev', action });
  ui.onReady = () => net.send({ t: 'ready' });
  ui.onGiveUp = () => net.send({ t: 'giveup' });
  ui.onAddBot = () => net.send({ t: 'addbot' });
  ui.onSpectate = (id) => renderer.spectate(id);
  ui.onRemoveBot = (id) => net.send({ t: 'removebot', id });
  ui.onEquip = (artifact) => net.send({ t: 'equip', artifact });

  /** Back to the menu: drop everything about the room we were in. */
  const leftRoom = () => {
    myId = null;
    latest = null;
    epoch = -1;
    buffer.clear();
    renderer.spectate(null);
    ui.leaveRoom();
    chat.dock(null);
    chat.setVisible(false);
    music.update(null, false);
  };

  net.onOpen = () => {
    menu.setStatus('');
    menu.start();
  };
  net.onWelcome = (id) => {
    myId = id;
    menu.hide();
    chat.setVisible(true);
  };
  net.onLeft = () => {
    leftRoom();
    menu.show('home');
  };
  net.onProfile = (profile) => {
    menu.setProfile(profile);
    ui.setProfile(profile);
  };
  net.onArtifact = (id, how) => menu.showArtifactResult(id, how);
  net.onRooms = (rooms) => menu.setRooms(rooms);
  net.onError = (message) => menu.setStatus(message);
  net.onClosed = () => {
    leftRoom();
    menu.show(menu.name ? 'home' : 'name');
    menu.setStatus('Lost the connection to the server. Reconnecting…');
  };
  menu.setStatus('Connecting…');
  net.connect();

  net.onSnapshot = (snap) => {
    if (myId === null) return; // Left the room; a last snapshot or two can still be on the way.
    buffer.push(snap);
    cues.onSnapshot(latest, snap, local, myId);
    latest = snap;
    const den = !!snap.finale && snap.finale.stage !== 'crumble';
    const wallsKey = `${snap.map}:${snap.arena?.open ? 'open' : 'shut'}:${den}`;
    if (wallsKey !== wallsFor) {
      const map = MAPS[snap.map];
      walls = new WallIndex(mapWalls(map, !snap.arena?.open, den), map.width, map.height);
      wallsFor = wallsKey;
    }
    if (snap.me && snap.me.epoch !== epoch) {
      // The server moved us (new run, went down, new map): jump to where it says we are.
      const me = snap.players.find((p) => p.id === myId);
      if (me) {
        local.x = me.x;
        local.y = me.y;
      }
      epoch = snap.me.epoch;
      dodgeTime = 0;
      dodgeCooldown = 0;
    }
    for (const fx of snap.fx) {
      if (fx.k === 'banner') {
        ui.showBanner(fx.text, fx.tone);
        chat.add(stamp(), fx.text, fx.tone);
      } else if (fx.k === 'log') {
        chat.add(stamp(), fx.text, fx.tone);
      } else if (fx.k === 'chat') {
        chat.add(stamp(), fx.text, 'chat', fx);
      } else {
        // Mordak's entrance is played in silence (but for his roar): his music comes in as the fight starts.
        if (fx.k === 'intro' && fx.dragon) silentUntil = performance.now() + (DRAGON_INTRO.hold + DRAGON_INTRO.ease * 0.5) * 1000;
        renderer.addFx(fx);
      }
    }
    if (snap.me) renderer.addDamageNumbers(snap.me.hits, snap.me.taken, local);
    if (snap.me?.found.length) ui.showFinds(snap.me.found);
    ui.update(snap, myId);
    // The map's music during a run (not in the lobby or on the results), quieter while paused. The boss theme takes
    // over when the fight starts: someone walks into the arena (or the boss shows up, on maps without one).
    // It fades out while a final boss dies, and stays quiet while the caldera falls apart (until the dragon comes).
    const bossTime = !!snap.bossFight;
    const hush = !!snap.dying || (!!snap.finale && snap.finale.stage !== 'den') || performance.now() < silentUntil;
    music.update(snap.phase === 'playing' && !hush ? MAPS[snap.map] : null, bossTime);
    music.setPaused(snap.pause?.kind === 'menu');
    chat.dock(snap.phase === 'lobby' ? ui.lobbyChatDock : null);
  };

  /** Whether a cast in this slot would go off (else it gets the "not ready" sound). */
  const ready = (slot: 'e' | 'r' | 'q'): boolean => {
    const meState = latest?.me;
    const me = latest?.players.find((p) => p.id === myId);
    if (!meState || !me) return false;
    if (slot === 'e') return meState.ability.cd <= 0;
    if (slot === 'q') return !!meState.relic && meState.relic.cd <= 0;
    // R also sends the Spirit Bear somewhere while it's out.
    const bearOut = CHARACTERS[me.character].ultimate.id === 'bear' && hasBear(latest!.summons);
    return me.ult >= 1 || bearOut;
  };

  renderer.app.ticker.add((ticker) => {
    const realDt = Math.min(ticker.deltaMS / 1000, 0.1);
    buffer.update(realDt); // Snapshots arrive in real time.
    // Everything else follows the game's speed, so you're in slow motion with the world while it eases back in.
    const dt = realDt * (latest?.timeScale ?? 1);

    const me = latest?.players.find((p) => p.id === myId);
    const meState = latest?.me;
    const canAct = !!(latest && meState && me && !me.downed && !latest.pause);
    const aim = Math.round(input.aim() * 100) / 100;
    const wantsDodge = input.consumeDodge();
    const cast = input.consumeCast();
    const cheat = input.consumeDev();
    // Esc / P: pause the game for everyone, or while it's paused, say you're ready to go on.
    if (input.consumePause() && latest?.phase === 'playing') {
      if (!latest.pause) net.send({ t: 'pause' });
      else if (latest.pause.kind === 'menu') net.send({ t: 'ready' });
    }
    if (cheat && isDevName(me?.name) && latest!.phase === 'playing') net.send({ t: 'dev', action: cheat });
    if (cast && canAct && latest!.phase === 'playing') {
      if (ready(cast)) net.send({ t: 'cast', slot: cast, aim, dist: Math.round(input.aimDistance()) });
      else sound.play('denied');
    }
    if (latest && !latest.pause) dodgeCooldown = Math.max(0, dodgeCooldown - dt);

    if (canAct) {
      if (wantsDodge && dodgeCooldown <= 0 && latest!.phase === 'playing') {
        dodgeTime = DODGE_DURATION;
        dashExtension = 0;
        // Dash the way you're moving (so you can shoot behind you and dodge forward); standing still, toward the cursor.
        const move = input.direction();
        dodgeDir = move.x !== 0 || move.y !== 0 ? move : { x: Math.cos(aim), y: Math.sin(aim) };
        dodgeCooldown = meState!.dodgeCooldown;
        net.send({ t: 'dodge' }); // Before the moves it causes, so the server allows the longer steps.
        sound.play('dodge');
      }
      let vx: number;
      let vy: number;
      // Dashing clears fences (and, for some heroes, any wall).
      let pass: PassFlags | undefined;
      if (dodgeTime > 0) {
        dodgeTime -= dt;
        vx = dodgeDir.x * DODGE_SPEED;
        vy = dodgeDir.y * DODGE_SPEED;
        pass = { thin: true, thick: CHARACTERS[me!.character].phaseWalls };
      } else {
        const dir = input.direction();
        vx = dir.x * meState!.speed;
        vy = dir.y * meState!.speed;
      }
      ({ x: local.x, y: local.y } = moveCircle(walls, local.x, local.y, vx * dt, vy * dt, PLAYER_RADIUS, pass));
      // Don't stop a dash halfway through a wall: carry on a little to come out the other side.
      if (pass && dodgeTime <= 0 && dashExtension < MAX_DASH_EXTENSION && overlapsWall(walls, local.x, local.y, PLAYER_RADIUS)) {
        dodgeTime += dt;
        dashExtension += dt;
      }
      // Locked inside the boss arena.
      const arena = MAPS[latest!.map].arena;
      if (me!.inArena && arena) ({ x: local.x, y: local.y } = clampToArena(arena, local.x, local.y, PLAYER_RADIUS));

      sendTimer += dt;
      if (sendTimer >= 1 / TICK_RATE) {
        sendTimer = 0;
        if (local.x !== lastSent.x || local.y !== lastSent.y || aim !== lastSent.aim) {
          net.send({ t: 'move', x: local.x, y: local.y, aim, epoch });
          lastSent = { ...local, aim };
        }
      }
    } else if (!latest?.pause) {
      // Down (or out of the run): the dash is over. A pause only freezes it: it carries on when the game does.
      dodgeTime = 0;
    }
    if (meState) ui.setDodge(1 - dodgeCooldown / meState.dodgeCooldown);

    const sample = buffer.sample();
    if (sample) renderer.render(sample, myId, local, canAct ? aim : null, dt, realDt);
  });
}

main();
