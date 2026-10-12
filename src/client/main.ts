import { DODGE_DURATION, DODGE_SPEED, PLAYER_RADIUS, TICK_RATE, WORLD_SIZE } from '../shared/constants';
import type { Snapshot } from '../shared/protocol';
import { Input } from './input';
import { Connection } from './net';
import { GameRenderer } from './renderer';
import { SnapshotBuffer } from './snapshots';
import { UI } from './ui';
import './style.css';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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
  const local = { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 };
  let epoch = -1;
  let sendTimer = 0;
  let lastSent = { x: NaN, y: NaN, aim: NaN };
  // Dodge dash in progress, and the cooldown until the next one.
  let dodgeTime = 0;
  let dodgeDir = { x: 0, y: 0 };
  let dodgeCooldown = 0;

  ui.onJoin = (name, character) => net.connect(name, character);
  ui.onPick = (character) => net.send({ t: 'pick', character });
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
    if (snap.me && snap.me.epoch !== epoch) {
      // The server moved us (new run, went down): jump to where it says we are.
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
      if (fx.k === 'boss') ui.showBanner('A boss approaches!');
      else renderer.addFx(fx);
    }
    ui.update(snap, myId);
  };

  renderer.app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.1);
    buffer.update(dt);

    const me = latest?.players.find((p) => p.id === myId);
    const meState = latest?.me;
    const canAct = !!(latest && meState && me && !me.downed && !latest.pause);
    const aim = Math.round(input.aim() * 100) / 100;
    const wantsDodge = input.consumeDodge();
    if (latest && !latest.pause) dodgeCooldown = Math.max(0, dodgeCooldown - dt);

    if (canAct) {
      if (wantsDodge && dodgeCooldown <= 0 && latest!.phase === 'playing') {
        dodgeTime = DODGE_DURATION;
        dodgeDir = { x: Math.cos(aim), y: Math.sin(aim) };
        dodgeCooldown = meState!.dodgeCooldown;
        net.send({ t: 'dodge' }); // Before the moves it causes, so the server allows the longer steps.
      }
      let vx: number;
      let vy: number;
      if (dodgeTime > 0) {
        dodgeTime -= dt;
        vx = dodgeDir.x * DODGE_SPEED;
        vy = dodgeDir.y * DODGE_SPEED;
      } else {
        const dir = input.direction();
        vx = dir.x * meState!.speed;
        vy = dir.y * meState!.speed;
      }
      local.x = clamp(local.x + vx * dt, PLAYER_RADIUS, WORLD_SIZE - PLAYER_RADIUS);
      local.y = clamp(local.y + vy * dt, PLAYER_RADIUS, WORLD_SIZE - PLAYER_RADIUS);

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
    if (sample) renderer.render(sample, myId, local, canAct ? aim : null, dt);
  });
}

main();
