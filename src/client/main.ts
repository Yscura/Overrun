import { CHARACTERS } from '../shared/characters';
import { WallIndex, moveCircle, overlapsWall, type PassFlags } from '../shared/collision';
import { DODGE_DURATION, DODGE_SPEED, PLAYER_RADIUS, TICK_RATE } from '../shared/constants';
import { MAPS } from '../shared/maps';
import type { Snapshot } from '../shared/protocol';
import { Input } from './input';
import { Connection } from './net';
import { GameRenderer } from './renderer';
import { SnapshotBuffer } from './snapshots';
import { UI } from './ui';
import './style.css';

/** A dash that ends inside a wall keeps going this much longer to come out the other side. */
const MAX_DASH_EXTENSION = 0.15;

async function main() {
  const renderer = new GameRenderer();
  await renderer.init(document.getElementById('app')!);

  const ui = new UI();
  const input = new Input();
  const net = new Connection();
  const buffer = new SnapshotBuffer();

  let myId: number | null = null;
  let latest: Snapshot | null = null;
  // Your own position is simulated locally so movement feels instant; the server just follows along.
  const local = { ...MAPS[0].spawn };
  let walls = new WallIndex(MAPS[0].walls, MAPS[0].width, MAPS[0].height);
  let wallsFor = 0;
  let epoch = -1;
  let sendTimer = 0;
  let lastSent = { x: NaN, y: NaN, aim: NaN };
  // Dodge dash in progress, and the cooldown until the next one.
  let dodgeTime = 0;
  let dashExtension = 0;
  let dodgeDir = { x: 0, y: 0 };
  let dodgeCooldown = 0;

  ui.onJoin = (name, character) => net.connect(name, character);
  ui.onPick = (character) => net.send({ t: 'pick', character });
  ui.onPickMap = (index) => net.send({ t: 'map', index });
  ui.onStart = () => net.send({ t: 'start' });
  ui.onLobby = () => net.send({ t: 'lobby' });
  ui.onChoose = (index) => net.send({ t: 'choose', index });

  net.onWelcome = (id) => {
    myId = id;
    ui.showJoined();
  };

  net.onClosed = (reason) => {
    myId = null;
    latest = null;
    epoch = -1;
    buffer.clear();
    ui.showDisconnected(reason);
  };

  net.onSnapshot = (snap) => {
    buffer.push(snap);
    latest = snap;
    if (snap.map !== wallsFor) {
      const map = MAPS[snap.map];
      walls = new WallIndex(map.walls, map.width, map.height);
      wallsFor = snap.map;
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
      if (fx.k === 'banner') ui.showBanner(fx.text, fx.tone);
      else renderer.addFx(fx);
    }
    if (snap.me) renderer.addDamageNumbers(snap.me.hits, snap.me.taken, local);
    ui.update(snap, myId);
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
    if (cast && canAct && latest!.phase === 'playing') {
      net.send({ t: 'cast', slot: cast, aim, dist: Math.round(input.aimDistance()) });
    }
    if (latest && !latest.pause) dodgeCooldown = Math.max(0, dodgeCooldown - dt);

    if (canAct) {
      if (wantsDodge && dodgeCooldown <= 0 && latest!.phase === 'playing') {
        dodgeTime = DODGE_DURATION;
        dashExtension = 0;
        dodgeDir = { x: Math.cos(aim), y: Math.sin(aim) };
        dodgeCooldown = meState!.dodgeCooldown;
        net.send({ t: 'dodge' }); // Before the moves it causes, so the server allows the longer steps.
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
      const arena = latest!.arena;
      if (me!.inArena && arena) {
        const dx = local.x - arena.x;
        const dy = local.y - arena.y;
        const d = Math.hypot(dx, dy);
        const max = arena.r - PLAYER_RADIUS;
        if (d > max) {
          local.x = arena.x + (dx / d) * max;
          local.y = arena.y + (dy / d) * max;
        }
      }

      sendTimer += dt;
      if (sendTimer >= 1 / TICK_RATE) {
        sendTimer = 0;
        if (local.x !== lastSent.x || local.y !== lastSent.y || aim !== lastSent.aim) {
          net.send({ t: 'move', x: local.x, y: local.y, aim, epoch });
          lastSent = { ...local, aim };
        }
      }
    } else {
      dodgeTime = 0;
    }
    if (meState) ui.setDodge(1 - dodgeCooldown / meState.dodgeCooldown);

    const sample = buffer.sample();
    if (sample) renderer.render(sample, myId, local, canAct ? aim : null, dt, realDt);
  });
}

main();
