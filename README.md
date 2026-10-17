# Overrun

A browser-based online co-op horde survivor (Vampire Survivors / LoL Swarm style) for up to 4 players.

## Run it

```sh
npm install
npm run dev
```

Open http://localhost:5173. The main menu has **Singleplayer** (a private game, with bot teammates if you like),
**Multiplayer** (create a lobby and share its 4-letter code, or join one from the list of open lobbies), the
**Bestiary** (every enemy with its stats; bosses unlock once you've reached them in a run, win or lose) and **Settings**
(volume). The card in the top right shows your name and most-played hero and opens your **Profile** (name, prestige
shop, artifacts and hero unlocks, also reachable from the lobby). Every tab
you open is another player, which is handy for testing co-op alone.

In a lobby the **host** (whoever created it, or the next player if they leave) picks the map, adds bots and starts the
game, once everyone else has pressed **Ready**. The server can run any number of lobbies at once; unlocked maps are
shared by everyone on it. Modes are defined in `src/shared/modes.ts`, so adding one later is a new entry there.
No friends online? **+ Add bot** in the lobby adds a bot teammate (up to a team of four) with a random hero. Bots
play on the server: they fight, dodge, use E and R, pick upgrades, revive you and do the boss missions. They don't save
any progress, the pause screen doesn't wait for them, and they leave when the last person does.
Code changes reload automatically (the client hot-reloads; the server restarts, which ends the current run).

## Play with friends

```sh
npm run build   # build the client into dist/
npm start       # game server + client on http://localhost:3000
```

Then give your friends a URL to that port, create a Multiplayer lobby and tell them its code:

- **Same network:** `http://<your-local-ip>:3000` (allow Node through the Windows firewall).
- **Over the internet, quickest:** install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
  and run `cloudflared tunnel --url http://localhost:3000`. It prints a public `https://….trycloudflare.com` link, no account needed.
- **Over the internet, private:** [Tailscale](https://tailscale.com/) on everyone's PC, then use your Tailscale IP.
- **Always online:** deploy to any Node host with WebSocket support (Fly.io, Render, Railway) using `npm run build && npm start`.

## Maps

| Map | Final boss | Boss fight | Enemy health and damage | Prestige per level |
|---|---|---|---|---|
| Emerald Woods | Sylvara, the Glade Serpent | A glade ringed by trees, east of the river | ×0.7 | 0.75 |
| Verdant Ruins | Grimm, the Reaper | A ruined colosseum east of the courtyard | ×1 | 1 |
| Frozen Fortress | Rime, the Frost Queen | The throne hall inside the castle keep | ×1.4 | 1.5 |
| Sunscar Canyon | Kharzak, Tyrant of the Canyon | A rocky den at the canyon's east end | ×1.5 | 1.75 |
| Ashen Caldera | Ashlord Vael and Embra, the Twin Flames | The heart of the caldera, as the lava closes in | ×2 | 2 |

- **Emerald Woods:** the first map, kept simple to get into the game: a sunny forest with groves of trees and a river
  down the middle. Cross it on one of two bridges or the ford on the path (or dodge across). Mostly the basic horde.
  The serpent's glade is behind a wall of brambles; Sylvara spits fans of venom and lunges.
- **Verdant Ruins:** the overgrown ruins and fenced courtyard, plus an old colosseum to the east behind a big gate.
- **Frozen Fortress:** a castle courtyard inside curtain walls (barracks, stables, a frozen fountain in a hedge
  garden, statues along the road), with the keep to the east. The Queen's throne hall is inside the keep.
- **Sunscar Canyon:** a desert canyon between mountain cliffs, with mesas, boulders and an abandoned mining camp. Lots
  of chargers and spitters. Kharzak, an armored scorpion, charges and stabs its tail down in a line of strikes.
- **Ashen Caldera:** a round plateau ringed by lava, with a broken ring of basalt and four obelisks around its heart.
  **Lava** burns everyone standing in it, friend or foe (20% of max HP per second for players, 25% for enemies, very
  little for bosses), unless they're invulnerable, e.g. mid-dodge.

Each map dresses the horde in its own colors (`enemyColors` in `maps.ts`): greens and blues in the woods, ice blues in
the fortress, dusty grays and browns in the canyon, fire and ash in the caldera. Each type keeps its own shape and a
color distinct from the others, and the bestiary shows every variant (click one to see which map it's from).

A run is about 16 minutes: the named boss arrives at 15:00. The horde ramps up gently at first and steeply over the last
few minutes (more health, more damage, faster, more elites; see `hordeScaling` in `src/shared/enemies.ts`), and keeps
growing if the boss fight drags on. Hordes are kept smallish (`HORDE_DENSITY`): fewer enemies, each tougher.

**Champions.** From about 3 minutes in, a few percent of enemies spawn as champions: bigger, with a colored ring,
4x the health, 1.5x the damage and 5x the XP, plus an affix: **Hasted** (yellow, much faster), **Vampiric** (red,
heals by hitting you), **Volatile** (orange, leaves a bomb when it dies) or **Splitting** (green, splits in three).
**Warlords** still show up every 3:20 (four per run) as a mini-boss fight: the horde out of sight scatters when one arrives, only trickles in (30% of the usual rate) until it dies, and it gets a health bar at the top of the screen (tuned in `WARLORD_FIGHT` in `src/server/game.ts`).

**Getting to the boss.** Boss arenas are walled off by a big gate until 15:00. Then the gate opens, and a burning zone
sweeps in from the map's far corners, closing in on the arena over 45 seconds and burning anyone it catches. The fight
starts when the first player walks in; anyone inside is locked in, and the gate slams shut once everyone still standing
is inside (it opens again if a teammate is revived outside). On Ashen Caldera the lava instead closes in on the middle
over 40 seconds (a ring of runes marks where it stops). No new enemies come while it does, and the horde is thinned to
fit the shrinking ground, farthest from the team first. When the lava stops, the Twin Flames arrive in the middle.
Players who fall in the lava wash up at its edge, where they can still be revived.
Bosses only take a short stun and are briefly immune afterwards, and they ignore Deep Freeze.

**The boss fight.**

- **5 minutes:** kill the boss within 5 minutes of the fight starting. After that it goes **berserk**, and every 30
  seconds it hits harder, attacks faster and makes its bomb circles, charge lanes and bullet rings bigger.
- **The horde backs off:** in an arena or the lava ring it's just you and the bosses (and their summons). On a map
  without either, all but the 30 enemies closest to the team scatter, and only a trickle keeps coming during the fight. Boss summons are smaller and skipped when the fight is crowded.
- **Phases:** at 66% and 33% of their health, bosses do their phase. Most put up a shield and are immune until the
  team completes a side mission (Sylvara and the twins: destroy 4 Wards; Grimm: banish 10 marked spirits; Rime: charge 3
  Sigils by standing in them). Kharzak hardens its shell instead. The berserk clock keeps running.
- **Twin Flames:** on Ashen Caldera you fight Ashlord Vael and Embra, a caster who keeps her distance, at the same time.
  Kill them close together: when one dies, the other heals 25% and turns **vengeful** (harder hits, faster and bigger
  attacks) for the rest of the fight.

**Boss mechanics.** Each boss has its own, inspired by Elder Scrolls Online's dungeon bosses. A banner explains each one
the first time it shows up in a fight, and each has its own telegraph: red for hits to get out of, amber with arrows
pointing in for "stack up", magenta with arrows pointing out for "spread out".

| Boss | Mechanics |
|---|---|
| Sylvara | **Venom spit** (a fan of shots), **venom pools** at everyone's feet, a **lunge**, **Hunter's Mark** (a circle that follows one player, then strikes: spread out), and a **clutch of eggs** that hatch into runners unless broken. The starter boss: one basic mechanic at a time. |
| Grimm, the Reaper | **Scythe swing** (a wide cone in front: get behind him), **shockwave** (a ring rolling outward: dodge through it or be out of reach), a charge, falling rubble, and teal **lost souls** that drift in through the walls from the arena's edge and heal him 4% each if they reach him. He whispers through the fight. |
| Rime, the Frost Queen | She laughs through the fight, and at every hero who falls. **Glacial Wrath**: she channels, then blasts everyone she can see for 65% of their max HP. Hide behind one of the hall's columns; the safe shadows are shown. Plus **Frost Bomb** (follows one player and goes off on everyone near them), **frost breath** (a long cone) and her ice nova. |
| Kharzak | **Burrow** (it vanishes, a mark hunts one player, and it bursts out there), a **pincer sweep** (a very wide short cone), its tail **sting** line, and a charge. **Hardened shell** at 66% and 33%: it shrugs off 85% of damage and keeps charging. Bait a charge into one of the den's boulders to crack it: it's stunned, then takes 50% extra damage for a while. |
| Twin Flames | Two winged demons who growl in turn through the fight (and the survivor roars when its twin dies). A **burning tether** between the twins hurts anyone standing in it. While they're close they're **kindred** and shrug off 40% of damage: pull them apart. Vael drops **meteors** whose damage is split between everyone inside (stack up); Embra throws **homing cinder orbs**. |

All of this is tuned in `src/shared/enemies.ts` (`NAMED_BOSSES` for each boss's rotation and phase, `BOSS_MECHANICS`, `BOSS_BERSERK`, `BOSS_VENGEFUL`, `BOSS_MISSIONS`). Beating the boss shows **Victory** and unlocks the next map.
Unlocks are saved in `data/progress.json` on the server, so the whole group shares them.

**Prestige.** Every run pays each player one prestige point per team level reached (times the map's multiplier above),
win or lose. Spend them in the lobby on permanent upgrades: Power (+4% damage), Fury (+3% attack speed), Swiftness (+3%
movement speed), Fortitude (+6% max HP) and Resolve (2% less damage taken). Ranks cost 5, 10, 15, … points, and
"Refund all" gives everything back for free. Prestige is saved per player name in `data/progress.json`, so use the same
name every time. The later maps are tuned to need a few runs' worth of prestige.

**Artifacts.** Champions (elites with an affix) sometimes drop an artifact, warlords often do, and beating the final
boss gives everyone one. Whoever touches a dropped artifact finds one of its tier for every person in the team (each
rolls their own), and any still lying around when the boss dies are found too. They go into your **inventory** on the
Profile page's Artifacts tab (duplicates stack), and you pick one to take into your runs in the lobby (one at a time;
you can't swap once you've locked in). There are four tiers, each with its own color: **common** (a small plain bonus),
**rare**, **epic** and **legendary**, and some trade a drawback for a big upside (Glass Edge: +22% damage, 15% more
damage taken). Later maps drop better tiers. Some artifacts can also be activated: the **Q** slot left of E shows your
artifact, and pressing Q uses its active (Tower Plate braces you, Windstep Anklet dashes, Storm Sigil and Eye of the
Storm blast the horde, the Crown rallies the team, the Aegis of Dawn raises a dome that makes everyone inside
untouchable...) on its own cooldown. The Jeweled Gauntlet lets magic damage crit.

On the Artifacts tab you can also **combine** five artifacts of one tier (click them into the slots under the orb)
into a random one of the next tier up, and spin the **artifact wheel** for 1000 gold: 52% common, 30% rare, 14% epic,
4% legendary. A run kills about 500 champions and three or four warlords, so a winning run finds around four or five.

All of it is in `src/shared/artifacts.ts`: each artifact is one line in `ARTIFACTS` (name, tier, icon, flavor and
`effects`, such as `{ damage: 0.22, damageTaken: 0.15 }`, plus an optional `active` for Q built from parts like
`heal`, `guard`, `frenzy`, `blast`, `stun`, `blink`, `invuln` and `rally`), and the descriptions everywhere are written
from those.
`DROPS` holds the drop chances and tier odds, `FORGE` how many it takes to combine, and `WHEEL` the spin's cost and odds. Profiles save artifacts by key, so rename one by changing its `name`.
To try one out: `npm run balance -- --map 1 --god --artifact glassEdge`.

**Walls:** thick walls (stone) block movement and all projectiles. Thin walls (fences) block movement but you can shoot
over them and dodge through them. Kael's dodge goes through thick walls too. Wraiths fly over everything.

**God mode:** join as `dev` and you take damage but never go down (toggle it with **G**), and every hero is unlocked and you always have at least one of every artifact. A DEV panel (top left) has cheats for testing:
**T** jumps the clock a minute ahead (with the level-ups you'd have earned; during the boss fight it pushes toward
berserk), **J** skips to just before the boss (picking the level-ups you'd have earned at random), **U** gives a free level-up pick, **F** a free Forge pick, and **B** fills your slots and maxes everything.

**Testing switches** for the server: `OVERRUN_BOSS_TIME=60` brings the final boss after a minute and
`OVERRUN_UNLOCK_ALL=1` unlocks every map. In PowerShell: `$env:OVERRUN_BOSS_TIME=60; npm run dev`.

**Music.** Every map has a theme and a boss theme (`sfx/<map>/`, rendered from the MIDI that
`scripts/compose_midi.py` writes to `sfx/midi/`). A map can list several themes; a run picks one at random. The boss
theme takes over when the fight starts (someone walks into the arena, or the boss shows up on maps without one).
Songs are shorter than a run, so each one jumps from a point late in the song back to an earlier one and keeps going
as long as it's needed: the songs loop exactly on the bar line (themes from bar 9, boss themes from bar 5). Music fades in when a run starts, dips while paused and
fades out when the run ends. Settings has a master volume plus separate sliders for music and sound effects. It's all set up in `MAP_MUSIC` in
`src/client/music.ts`.

## Controls

Pick a hero in the lobby. Ranged and melee heroes are offered different weapons:

| Hero | Role | Starts with | E ability (levels up) | R ultimate | Trait |
|---|---|---|---|---|---|
| Kael, the Assassin | Melee | Shadow Daggers | Shadow Veil: vanish (enemies lose you and can't touch you), then erupt | Shadow Strike (45s): blink between 7 enemies | +40% damage, 30% smaller areas, 70 HP, phases through walls |
| Lyra, the Mage | Ranged | Arcane Bolt | Meteor: lands at your cursor | Chrono Freeze (70s) | +15% damage |
| Brakka, the Bruiser | Melee | Cleave | Leap: jump to your cursor and smash | Bloodrage (60s): 8s of damage, lifesteal and can't drop below 1 HP | Regenerates HP |
| Torvald, the Tank | Melee | Ground Slam | War Cry: taunt enemies, take less damage | Rally (90s): heal, shield, revive | Takes 25% less damage |
| Ignis, the Pyromancer | Ranged | Fireball | Flame Nova: fire ring that leaves the ground burning | Inferno (60s): fireballs rain around you | +25% damage, 30% bigger areas, 70 HP |
| Sylva, the Ranger | Ranged | Longbow | Tumble: roll toward the cursor and loose a fan of arrows | Arrow Storm (50s): 4s of rapid fire at the cursor | +15% damage, fast, dodges every 1.4s |
| Oakhart, the Druid | Melee | Wolf Pack (druid only) | Call of the Wild: more spirit wolves join the hunt for a while | Spirit Bear (70s): a slow, hard-hitting bear fights beside you for 18s; R again sends it at the enemy nearest your cursor | 200 HP, regenerates |
| Vex, the Chronobreaker | Melee | Spirit Blades | Time Bomb: detonates at the cursor and stuns | Chronobreak (60s): rewind 4s, restore HP, explode | +15% damage |
| Vessa, the Alchemist | Ranged | Flask Toss: splash and acid puddles | Toxic Pool: a wide, long-lasting pool of poison at the cursor | Grand Elixir (75s): heal 30%, then 8s of +25% damage, faster attacks, speed and armor | +15% damage |
| Aldric, the Paladin | Melee | Judgment Hammer (magic) | Consecration: hallowed ground that burns enemies and heals allies | Avenging Wrath (70s): 8s of light pillars, half damage taken | 150 HP, armored |
| Seraphine, the Cleric | Ranged | Smite: strikes the nearest enemy, heals the most hurt ally | Prayer of Light: heal and shield allies around you, sear enemies | Divine Intervention (120s): every ally up, full HP, 3s invulnerable | The healer |

The first four heroes are free. Ignis, Sylva, Oakhart, Vex, Vessa, Aldric and Seraphine cost 500 gold each (a full run brings in a few hundred):
click their card in the lobby. `OVERRUN_UNLOCK_ALL=1` also unlocks every hero.

WASD / arrows to move. Aimed weapons (bolts, knives, cleave) go toward your mouse cursor; the rest work on their own.
Space dodges in the direction you're moving (toward the cursor when standing still): a quick dash during which nothing can hurt you, so you can keep shooting behind you while dashing away. E casts your hero's ability, R their ultimate, and Q uses your artifact (if it can be activated).
**Esc** or **P** pauses the game for everyone; it carries on once every player has pressed Ready. Hold Tab for the scoreboard: everyone's HP, kills, damage dealt and taken, build and stats. M mutes sound (volume slider in
the top-left corner). Impacts, swings, explosions, roars and the like are recordings (`sfx/effects/`, listed in
`src/client/samples.ts` with their volumes); everything else is synthesized in the browser (`src/client/audio.ts`),
and so is a recorded sound until its file has loaded. The recordings are cut to start right on the sound, cleaned of
sub-bass rumble and made equally loud, so a sound's `volume` in `samples.ts` is purely the mix.

**Chat and pings.** The box in the bottom-left corner is both the chat and the event log: players joining and leaving,
upgrade points and quests appearing, boss arrivals, players going down and getting back up, each with a timestamp (run
time during a run, the clock in the lobby). Press **Enter** to type, **Enter** again to send (Esc cancels).
**Shift+click** the map or the minimap to ping a spot: everyone hears it and sees a marker with your name for a few
seconds, plus an arrow at the screen edge if it's out of view. **Shift+click** your weapons, passives and E/R slots to
share them in chat (with the current cooldown for E and R). On the Tab screen a plain click shares: a teammate's kills, damage,
damage taken, ult charge, HP or one of their weapons, e.g. "(Bo) 3,214 damage" or "(Bo) Whirlwind (level 3/5)".

**Damage types.** Every weapon and ability deals **physical** (orange numbers), **magic** (blue) or **true** (white)
damage; level-up cards and weapon slots show which. Only physical damage can crit. Some enemies resist a type, shown as a
rim around them: steel for armor (Brutes, Chargers, Warlords, Wraiths, Ashlord Vael), blue for a ward
(Bombardiers, Warlords, Rime, Embra, the boss-fight wards), and champions can be **Armored** or **Warded** on top of that.
True damage (crate bombs, Vex's Time Bomb and Chronobreak) goes through everything. The Twin Flames are the big test:
Ashlord resists physical, Embra resists magic. Hold Tab to see each player's damage split.

**Attunement.** Every extra weapon or ability of the same damage type makes that type stronger: +10% per extra magic
one (magic can't crit, so it attunes more), +6% per extra physical or true one. A full magic build (four magic weapons
plus Meteor) deals +40% magic damage. **Arcana** is the magic counterpart to Crit: +8% magic damage per level. Level-ups
lean toward your hero's own damage type: matching weapons come up about three times as often, and Crit (physical
heroes) or Arcana (magic heroes) twice as often.

You carry up to **4 weapons** (plus your E ability) and **5 passives**. Once a slot type is full, level-ups only offer
upgrades for what you already have. Weapons: Arcane Bolt, Throwing Knives, Lightning Storm, Seeker Hex, Shuriken, Fireball and Longbow (ranged),
Cleave, Ground Slam, Venom Trail and Shadow Daggers (melee), Spirit Blades, Radiant Field and Mine Layer (anyone), and
Wolf Pack (druid only). Passives: Might,
Haste, Swiftness, Vitality, Magnet, Regeneration, Plating, Crit (physical only), Arcana (magic), Vampirism (lifesteal, capped per second), Expanse (area),
Persistence (duration), Multishot, Evasion and Wisdom (XP).

Red zones on the ground are attacks about to land: bomb circles fill up and then explode, and a red lane shows where a
Charger is about to dash. Green orbs from Spitters can be dodged or outrun.

XP is shared by the team. On a level-up the game pauses and everyone picks one of three upgrades with 1 / 2 / 3 (or a click).
You have 15 seconds before one is picked for you; once everyone has chosen, the game eases back in from slow motion.

**Crates** appear around the team every 18 seconds. Shoot or hit one to break it open: it holds a **heart** (walk over
it to heal 20% of your max HP; players at full HP leave it for teammates), a pile of **gold coins**, or a **bomb**. Bombs
go off when anything hits them, blasting enemies around them (never players) and setting off other crates and bombs
nearby. **Gold** flies to you like gems and everyone on the team gets all of it. It's kept between runs (in
`data/progress.json`, by player name) and buys new heroes.

**Upgrade points** appear on the map (arrows on the screen edge point to them). Stand inside one to fill it up; the more
of the team stands inside, the faster it fills. Altars and Quest points show up every 40 seconds (at most two at a time);
Forges come on a fixed schedule: 6 per run, at 2:15, 3:36, 4:57, 6:07, 7:12 and 8:06.

- **Forge** (orange): everyone picks a weapon upgrade. A weapon or E ability at level 5 can **evolve** to level 6, which
  is only possible here (Arcane Barrage, Blade Fan, Tempest, Hex Swarm, Shuriken Storm, Pyroblast, Hunter's Volley,
  Whirlwind, Earthshatter, Plague, Eviscerate, Solar Flare, Minefield, Spirit Vortex, Alpha Pack; abilities: Shadow
  Dance, Starfall, Cataclysm, Unbreakable, Supernova, Hail of Arrows, Ancient Grove, Paradox). Evolving all four weapons and
  your ability takes 5 Forges, so a team that captures every Forge and plans its picks can max out everything.
- **Altar** (cyan): a 20-second team-wide effect: Deep Freeze, Frenzy (double damage), Haste or Vacuum.
- **Quest** (yellow): starts a quest: get the whole team to a rally point, or chase down a gold thief. Success drops a pile of gems.
Stand inside a downed teammate's red circle to revive them (a green arc fills around its edge). Downed teammates get a
red cross above them, on the minimap and as an arrow at the screen edge when they're out of view. The chat announces "An ally has fallen". The run ends when everyone has fallen.

## Balance testing with bots

```sh
npm run balance -- --map 0 --heroes mage,tank,ranger,druid --runs 3
npm run balance -- --map all --god          # bots can't die, so every run reaches the boss
```

Bots (`src/server/bot.ts`, the same ones you can add in the lobby) play like a real client: they only see snapshots and only move, dodge, cast and pick upgrades.
They kite and dodge telegraphs, use E and R, take upgrade points, hearts and Forges, revive each other and do the boss
side missions. The report shows how far the team got, the boss fight length, damage taken per minute, and each hero's
share of the team's damage (1.0 = an even share), downs and kills, and the artifacts found. Options: `--prestige N` (all
prestige upgrades at rank N), `--artifact ID` (every bot takes that artifact), `--skill 0..1`, `--boss-time S`, `--log`.

The bots play worse than a good human (they lose by the middle of a run in normal mode), so use them to compare: before
and after a change, or hero against hero. `--god` is the way to look at the late game and the boss fights.

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
- `artifacts.ts`: the artifacts (tier, icon, effects), their drop chances and tier odds.
- `objectives.ts`: upgrade points, Altar events and Quest quests (timings, sizes, rewards).
- `maps.ts`: the maps (size, walls, theme, enemy mix, boss, arena and its gate, lava) and the boss timing. Walls are
  built from small helpers like `room(...)` (a room with door gaps), `fenceH`/`fenceV`, `pillar`, `arc` (a stretch of
  round wall) and `colosseum` (a round wall with a gate). An arena is round (`r`) or a rectangular `hall`. A wall's
  `look` draws it as a tree, rock or water instead of stonework; each map's `art` picks its ground, props and landmarks
  (in `src/client/mapArt.ts`). Unlocked maps are saved as a count of `MAPS`, so `src/server/progress.ts` moves old saves
  over when the list changes (`MAPS_VERSION`).

Enemies find their way around walls with a flow field (`src/server/navigation.ts`): one pathfinding pass from all
players per few ticks, which every enemy then follows. That scales to hundreds of enemies where per-enemy A* wouldn't.

A new enemy using an existing behavior is just a new `ENEMY_TYPES` entry. A new behavior goes in `Game.moveEnemies`.
A new weapon needs an `UPGRADES` entry plus its firing logic in `Game.fire` (and drawing in the renderer if it's new
kind of visual). Hero portraits are the images in `img/` (wired up in `src/client/portraits.ts`); body shapes are in `GameRenderer.bodyTextures`.
