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

## Maps

| Map | Final boss | Boss fight | Enemy health and damage | Prestige per level |
|---|---|---|---|---|
| Verdant Ruins | Grimjaw, the Ruin Beast | Wherever you are | ×1 | 1 |
| Frozen Fortress | Rime, Queen of the Frozen Fortress | Arena to the east | ×1.5 | 1.5 |
| Ashen Caldera | Ashlord Vael and Embra, the Twin Flames | Arena to the north | ×2.2 | 2 |

A run is about 10 minutes: the named boss arrives at 9:00. The horde ramps up gently at first and steeply over the last
few minutes (more health, more damage, faster, more elites; see `hordeScaling` in `src/shared/enemies.ts`), and keeps
growing if the boss fight drags on. On arena maps a burning zone then sweeps in from the map's far corners, closing in on
the arena over 45 seconds and burning anyone it catches, and anyone who enters the arena is locked in until the fight ends.
Bosses only take a short stun and are briefly immune afterwards, and they ignore Deep Freeze.

**The boss fight.**

- **5 minutes:** kill the boss within 5 minutes of the fight starting. After that it goes **berserk**, and every 30
  seconds it hits harder, attacks faster and makes its bomb circles, charge lanes and bullet rings bigger.
- **Side missions:** at 66% and 33% of their health, bosses put up a shield and are immune until the team completes a
  side mission. That's one of: destroy 4 Wards, charge 3 Sigils by standing in them, or kill a marked brood. The
  berserk clock keeps running.
- **Twin Flames:** on Ashen Caldera you fight Ashlord Vael and Embra, a caster who keeps her distance, at the same time.
  Kill them close together: when one dies, the other heals 25% and turns **vengeful** (harder hits, faster and bigger
  attacks) for the rest of the fight.

All of this is tuned in `src/shared/enemies.ts` (`BOSS_BERSERK`, `BOSS_VENGEFUL`, `BOSS_MISSIONS`). Beating the boss shows **Victory** and unlocks the next map.
Unlocks are saved in `data/progress.json` on the server, so the whole group shares them.

**Prestige.** Every run pays each player one prestige point per team level reached (times the map's multiplier above),
win or lose. Spend them in the lobby on permanent upgrades: Power (+4% damage), Fury (+3% attack speed), Stride (+3%
movement speed), Fortitude (+6% max HP) and Resolve (2% less damage taken). Ranks cost 5, 10, 15, … points, and
"Refund all" gives everything back for free. Prestige is saved per player name in `data/progress.json`, so use the same
name every time. The later maps are tuned to need a few runs' worth of prestige.

**Walls:** thick walls (stone) block movement and all projectiles. Thin walls (fences) block movement but you can shoot
over them and dodge through them. Kael's dodge goes through thick walls too. Wraiths fly over everything.

**Testing switches** for the server: `OVERRUN_BOSS_TIME=60` brings the final boss after a minute and
`OVERRUN_UNLOCK_ALL=1` unlocks every map. In PowerShell: `$env:OVERRUN_BOSS_TIME=60; npm run dev`.

## Controls

Pick a hero in the lobby. Ranged and melee heroes are offered different weapons:

| Hero | Role | Starts with | E ability (levels up) | R ultimate | Trait |
|---|---|---|---|---|---|
| Kael, the Assassin | Melee | Shadow Daggers | Shadow Veil: vanish (enemies lose you and can't touch you), then erupt | Shadow Strike (45s): blink between 7 enemies | +40% damage, 30% smaller areas, 70 HP, phases through walls |
| Lyra, the Mage | Ranged | Arcane Bolt | Meteor: lands at your cursor | Chrono Freeze (70s) | +15% damage |
| Brakka, the Bruiser | Melee | Cleave | Leap: jump to your cursor and smash | Bloodrage (60s) | Regenerates HP |
| Torvald, the Tank | Melee | Ground Slam | War Cry: taunt enemies, take less damage | Rally (90s): heal, shield, revive | Takes 25% less damage |
| Ignis, the Pyromancer | Ranged | Fireball | Flame Nova: fire ring that leaves the ground burning | Inferno (60s): fireballs rain around you | +25% damage, 30% bigger areas, 70 HP |
| Sylva, the Ranger | Ranged | Longbow | Tumble: roll toward the cursor and loose a fan of arrows | Arrow Storm (50s): 4s of rapid fire at the cursor | +15% damage, fast, dodges every 1.4s |
| Oakhart, the Druid | Melee | Wolf Pack (druid only) | Treant: summons a tree that slams and roots | Call of the Wild (70s): 6 more wolves for 15s | 200 HP, regenerates |
| Vex, the Chronobreaker | Melee | Spirit Blades | Time Bomb: detonates at the cursor and stuns | Chronobreak (60s): rewind 4s, restore HP, explode | +15% damage |

The first four heroes are free. Ignis, Sylva, Oakhart and Vex are unlocked per player for 40 prestige each: click their
card in the lobby (refunding prestige ranks doesn't lock them again). `OVERRUN_UNLOCK_ALL=1` also unlocks every hero.

WASD / arrows to move. Aimed weapons (bolts, knives, cleave) go toward your mouse cursor; the rest work on their own.
Space dodges toward the cursor: a quick dash during which nothing can hurt you. E casts your hero's ability, R their ultimate.
Hold Tab for the scoreboard: everyone's HP, kills, damage dealt and taken, build and stats. M mutes sound (volume slider in
the top-left corner). All sound effects are synthesized in the browser (`src/client/audio.ts`), so there are no audio files.

You carry up to **4 weapons** (plus your E ability) and **5 passives**. Once a slot type is full, level-ups only offer
upgrades for what you already have. Weapons: Arcane Bolt, Throwing Knives, Lightning Storm, Seeker Hex, Shuriken, Fireball and Longbow (ranged),
Cleave, Ground Slam, Venom Trail and Shadow Daggers (melee), Spirit Blades, Radiant Field and Mine Layer (anyone), and
Wolf Pack (druid only). Passives: Might,
Haste, Swiftness, Vitality, Magnet, Regeneration, Plating, Crit, Vampirism (lifesteal, capped per second), Expanse (area),
Persistence (duration), Multishot, Evasion and Wisdom (XP).

Red zones on the ground are attacks about to land: bomb circles fill up and then explode, and a red lane shows where a
Charger is about to dash. Green orbs from Spitters can be dodged or outrun.

XP is shared by the team. On a level-up the game pauses and everyone picks one of three upgrades with 1 / 2 / 3 (or a click).
You have 15 seconds before one is picked for you; once everyone has chosen, the game eases back in from slow motion.

Shoot a health crate to break it, then walk over the heart to heal 20% of your max HP (players at full HP leave it for teammates).

**Upgrade points** appear on the map (arrows on the screen edge point to them). Stand inside one to fill it up; the more
of the team stands inside, the faster it fills. Altars and Beacons show up every 40 seconds (at most two at a time);
Forges come on a fixed schedule: 6 per run, at 2:15, 3:36, 4:57, 6:07, 7:12 and 8:06.

- **Forge** (orange): everyone picks a weapon upgrade. A weapon or E ability at level 5 can **evolve** to level 6, which
  is only possible here (Arcane Barrage, Blade Fan, Tempest, Hex Swarm, Shuriken Storm, Pyroblast, Hunter's Volley,
  Whirlwind, Earthshatter, Plague, Eviscerate, Solar Flare, Minefield, Spirit Vortex, Alpha Pack; abilities: Shadow
  Dance, Starfall, Cataclysm, Unbreakable, Supernova, Hail of Arrows, Ancient Grove, Paradox). Evolving all four weapons and
  your ability takes 5 Forges, so a team that captures every Forge and plans its picks can max out everything.
- **Altar** (cyan): a 20-second team-wide effect: Deep Freeze, Frenzy (double damage), Haste or Vacuum.
- **Beacon** (yellow): starts a quest: get the whole team to a rally point, or chase down a gold thief. Success drops a pile of gems.
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
- `upgrades.ts`: weapons and passives (per-level stats, evolutions, card text, which role can get them) and the XP curve.
- `prestige.ts`: the permanent upgrades bought between runs, their costs and the points a run pays.
- `objectives.ts`: upgrade points, Altar events and Beacon quests (timings, sizes, rewards).
- `maps.ts`: the maps (size, walls, theme, enemy mix, boss and arena) and the boss timing. Walls are built from small
  helpers like `room(...)` (a room with door gaps), `fenceH`/`fenceV` and `pillar`.

Enemies find their way around walls with a flow field (`src/server/navigation.ts`): one pathfinding pass from all
players per few ticks, which every enemy then follows. That scales to hundreds of enemies where per-enemy A* wouldn't.

A new enemy using an existing behavior is just a new `ENEMY_TYPES` entry. A new behavior goes in `Game.moveEnemies`.
A new weapon needs an `UPGRADES` entry plus its firing logic in `Game.fire` (and drawing in the renderer if it's new
kind of visual). Hero portraits are SVG in `src/client/portraits.ts`; body shapes are in `GameRenderer.bodyTextures`.
