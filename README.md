# Overrun

A browser-based online co-op horde survivor (Vampire Survivors / LoL Swarm style) for up to 4 players.

## Run it

```sh
npm install
npm run dev
```

Open http://localhost:5173. Every tab you open is another player, which is handy for testing co-op alone.
Code changes reload automatically (the client hot-reloads; the server restarts, which ends the current run).

## Play with friends

```sh
npm run build   # build the client into dist/
npm start       # game server + client on http://localhost:3000
```

Then give your friends a URL to that port:

- **Same network:** `http://<your-local-ip>:3000` (allow Node through the Windows firewall).
- **Over the internet, quickest:** install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
  and run `cloudflared tunnel --url http://localhost:3000`. It prints a public `https://….trycloudflare.com` link, no account needed.
- **Over the internet, private:** [Tailscale](https://tailscale.com/) on everyone's PC, then use your Tailscale IP.
- **Always online:** deploy to any Node host with WebSocket support (Fly.io, Render, Railway) using `npm run build && npm start`.

## Controls

Pick a hero in the lobby. Ranged and melee heroes are offered different weapons:

| Hero | Role | Starts with | Trait |
|---|---|---|---|
| Kael, the Assassin | Ranged | Throwing Knives | Fastest, dodges most often |
| Lyra, the Mage | Ranged | Arcane Bolt | +15% damage |
| Brakka, the Bruiser | Melee | Cleave | Regenerates HP |
| Torvald, the Tank | Melee | Ground Slam | Takes 25% less damage |

WASD / arrows to move. Aimed weapons (bolts, knives, cleave) go toward your mouse cursor; the rest work on their own.
Space dodges toward the cursor: a quick dash during which nothing can hurt you.

Red zones on the ground are attacks about to land: bomb circles fill up and then explode, and a red lane shows where a
Charger is about to dash. Green orbs from Spitters can be dodged or outrun.

XP is shared by the team. On a level-up the game pauses and everyone picks one of three upgrades with 1 / 2 / 3 (or a click).
You have 15 seconds before one is picked for you; once everyone has chosen, a 3-second countdown resumes the game.

Shoot a health crate to break it, then walk over the heart to heal 20% of your max HP (players at full HP leave it for teammates).
Stand next to a downed teammate to revive them. The run ends when everyone is down.

## How it's built

| Path | What |
|---|---|
| `src/shared/` | Code used by both sides: tuning constants, enemy stats, upgrades/weapons, network message types |
| `src/server/game.ts` | The authoritative simulation: spawning, enemy AI, weapons, XP, revives, snapshots |
| `src/server/index.ts` | HTTP + WebSocket server, fixed 30 Hz tick loop |
| `src/client/main.ts` | Glue: local movement, sending input, receiving snapshots |
| `src/client/renderer.ts` | PixiJS (WebGL) drawing, sprite pooling, particles |
| `src/client/snapshots.ts` | Buffers snapshots and interpolates between them for smooth motion |
| `src/client/ui.ts` | HTML overlays: lobby, HUD, level-up cards, results |

**Networking model.** The server runs the game and sends a snapshot 30 times a second. Clients draw other entities
~100 ms in the past, interpolated, so motion is smooth despite network jitter. Your *own* movement is handled locally and
sent to the server (it only sanity-checks the distance), so moving always feels instant. That trust is fine for a game among friends.

**Adding content.** Balance numbers live in `src/shared/`:

- `characters.ts`: heroes (stats, role, starting weapon) and how passives turn into stats (`playerStats`).
- `enemies.ts`: enemy stats, when they start spawning and how often, and the special attacks' tuning.
- `upgrades.ts`: weapons and passives (per-level stats, card text, which role can get them) and the XP curve.

A new enemy using an existing behavior is just a new `ENEMY_TYPES` entry. A new behavior goes in `Game.moveEnemies`.
A new weapon needs an `UPGRADES` entry plus its firing logic in `Game.fire` (and drawing in the renderer if it's new
kind of visual). Hero portraits are SVG in `src/client/portraits.ts`; body shapes are in `GameRenderer.bodyTextures`.
