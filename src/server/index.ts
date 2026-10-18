import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { TICK_RATE } from '../shared/constants';
import { MODES, isModeId } from '../shared/modes';
import { DEV_NAME, type ClientMessage, type ServerMessage } from '../shared/protocol';
import { CAMPAIGN, MAPS } from '../shared/maps';
import { Game } from './game';
import { buyHero, buyPrestige, combineArtifacts, equipArtifact, getProfile, profileState, refundPrestige, spinWheel } from './profiles';
import { loadProgress, saveProgress } from './progress';
import { Rooms, type Room } from './rooms';

const PORT = Number(process.env.PORT) || 3000;
const STEP_MS = 1000 / TICK_RATE;

// Serve the built client (npm run build) so friends only need one URL.
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = path.join(distDir, urlPath);
  const inside = file.startsWith(distDir + path.sep);
  if (!inside || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(distDir, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Client not built. Run "npm run build" first, or use "npm run dev" and open the Vite URL.');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

// Testing switches: OVERRUN_BOSS_TIME=60 brings the final boss after a minute; OVERRUN_UNLOCK_ALL=1 opens every map.
const bossTime = Number(process.env.OVERRUN_BOSS_TIME) || undefined;
const progress = loadProgress();
const unlockAll = Boolean(process.env.OVERRUN_UNLOCK_ALL);
const save = () => saveProgress(progress);

// Every lobby is a room with its own game. Map unlocks are shared by everyone on this server.
const rooms = new Rooms(
  (room) =>
    new Game({
      unlocked: unlockAll ? CAMPAIGN : progress.unlocked,
      onUnlock: (unlocked) => {
        progress.unlocked = Math.max(progress.unlocked, unlocked);
        save();
        for (const other of rooms.all()) other.game.setUnlocked(progress.unlocked);
        console.log(`Unlocked ${MAPS[unlocked - 1].name}`);
      },
      hardUnlocked: unlockAll ? CAMPAIGN : progress.hardUnlocked,
      onHardUnlock: (unlocked) => {
        progress.hardUnlocked = Math.max(progress.hardUnlocked, unlocked);
        save();
        for (const other of rooms.all()) other.game.setHardUnlocked(progress.hardUnlocked);
        console.log(`Unlocked ${MAPS[unlocked - 1].name} on hard mode`);
      },
      bossTime,
      profiles: progress.profiles,
      onProfiles: save,
      allHeroes: unlockAll,
      room,
      hostControls: true,
    }),
);
const wss = new WebSocketServer({ server, path: '/ws', perMessageDeflate: { threshold: 1024 } });

/** One connection: who they are, and which room they're in (if any). */
interface Session {
  name: string | null;
  room: Room | null;
  playerId: number | null;
}

wss.on('connection', (ws) => {
  const session: Session = { name: null, room: null, playerId: null };
  const send = (msg: ServerMessage) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };
  const allHeroes = () => unlockAll || session.name?.toLowerCase() === DEV_NAME;
  const sendProfile = () => {
    if (session.name) send({ t: 'profile', profile: profileState(session.name, getProfile(progress.profiles, session.name), allHeroes()) });
  };

  const leave = () => {
    const room = session.room;
    if (!room || session.playerId === null) return;
    room.game.removePlayer(session.playerId);
    console.log(`${session.name} left ${room.code}`);
    rooms.removeIfEmpty(room);
    session.room = null;
    session.playerId = null;
  };

  const enter = (room: Room, character: unknown) => {
    const id = room.game.addPlayer(session.name!, character, (text) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(text);
    });
    if (id === null) {
      send({ t: 'error', message: 'That lobby is full.' });
      rooms.removeIfEmpty(room);
      return;
    }
    session.room = room;
    session.playerId = id;
    send({ t: 'welcome', id, room: { code: room.code, mode: room.mode } });
    console.log(`${session.name} joined ${room.code} (${MODES[room.mode].name})`);
  };

  ws.on('message', (data) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    switch (msg.t) {
      case 'hello':
        // Names can't change mid-game: your progress is saved under it.
        if (session.room) return;
        session.name = String(msg.name ?? '').trim().slice(0, 16) || 'Player';
        sendProfile();
        return;
      case 'profile':
        sendProfile();
        return;
      case 'rooms':
        send({ t: 'rooms', rooms: rooms.list() });
        return;
      case 'create':
        if (!session.name || session.room || !isModeId(msg.mode)) return;
        enter(rooms.create(msg.mode), msg.character);
        return;
      case 'join': {
        if (!session.name || session.room) return;
        const room = rooms.get(String(msg.code ?? ''));
        const problem = rooms.joinProblem(room);
        if (problem) send({ t: 'error', message: problem });
        else enter(room!, msg.character);
        return;
      }
      case 'leave':
        leave();
        send({ t: 'left' });
        sendProfile(); // A run may have earned gold and prestige.
        return;
      case 'prestige':
      case 'respec':
      case 'unlock':
      case 'equip':
        // In a room the game handles these (it also re-equips you); in the menu we do it here.
        if (session.room && session.playerId !== null) {
          session.room.game.handleMessage(session.playerId, msg);
        } else if (session.name) {
          const profile = getProfile(progress.profiles, session.name);
          const changed =
            msg.t === 'prestige'
              ? buyPrestige(profile, msg.id)
              : msg.t === 'unlock'
                ? buyHero(profile, msg.character, allHeroes())
                : msg.t === 'equip'
                  ? equipArtifact(profile, msg.artifact)
                  : (refundPrestige(profile), true);
          if (changed) save();
        }
        sendProfile();
        return;
      case 'combine':
      case 'spin': {
        // Between runs only (your artifact can't change mid-run).
        if (!session.name || session.room?.game.running) return;
        const profile = getProfile(progress.profiles, session.name);
        const result = msg.t === 'combine' ? combineArtifacts(profile, msg.artifacts) : spinWheel(profile);
        if (result) {
          save();
          send({ t: 'artifact', id: result, how: msg.t });
          if (session.room && session.playerId !== null) session.room.game.profileChanged(session.playerId);
        }
        sendProfile();
        return;
      }
      default:
        if (session.room && session.playerId !== null) session.room.game.handleMessage(session.playerId, msg);
    }
  });

  ws.on('close', leave);
});

// Fixed-step loop: timers are imprecise, so catch up on however many ticks are due.
let last = performance.now();
let acc = 0;
setInterval(() => {
  const now = performance.now();
  acc += now - last;
  last = now;
  let steps = 0;
  while (acc >= STEP_MS && steps < 5) {
    rooms.tick();
    acc -= STEP_MS;
    steps++;
  }
  if (steps === 5) acc = 0; // Way behind (e.g. the PC slept); don't fast-forward.
}, STEP_MS / 2);

server.listen(PORT, () => console.log(`Overrun server on http://localhost:${PORT}`));
