import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { TICK_RATE } from '../shared/constants';
import type { ClientMessage } from '../shared/protocol';
import { MAPS } from '../shared/maps';
import { Game } from './game';
import { loadUnlocked, saveUnlocked } from './progress';

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
const game = new Game({
  unlocked: process.env.OVERRUN_UNLOCK_ALL ? MAPS.length : loadUnlocked(),
  onUnlock: (unlocked) => {
    saveUnlocked(unlocked);
    console.log(`Unlocked ${MAPS[unlocked - 1].name}`);
  },
  bossTime,
});
const wss = new WebSocketServer({ server, path: '/ws', perMessageDeflate: { threshold: 1024 } });

wss.on('connection', (ws) => {
  let playerId: number | null = null;

  ws.on('message', (data) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg.t === 'join') {
      if (playerId !== null) return;
      const name = String(msg.name ?? '').trim().slice(0, 16) || 'Player';
      playerId = game.addPlayer(name, msg.character, (text) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(text);
      });
      if (playerId === null) {
        ws.send(JSON.stringify({ t: 'full' }));
        ws.close();
        return;
      }
      ws.send(JSON.stringify({ t: 'welcome', id: playerId }));
      console.log(`${name} joined`);
      return;
    }
    if (playerId !== null) game.handleMessage(playerId, msg);
  });

  ws.on('close', () => {
    if (playerId !== null) game.removePlayer(playerId);
  });
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
    game.tick();
    acc -= STEP_MS;
    steps++;
  }
  if (steps === 5) acc = 0; // Way behind (e.g. the PC slept); don't fast-forward.
}, STEP_MS / 2);

server.listen(PORT, () => console.log(`Overrun server on http://localhost:${PORT}`));
