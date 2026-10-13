// Plays full runs with bots and reports how they went, for balancing.
//
//   npm run balance -- --map 0 --heroes mage,tank,ranger,druid --runs 3
//
// Options:
//   --map N|all       map index (0 = Verdant Ruins), or every map (default 0)
//   --heroes a,b,...  one bot per hero (default: mage,bruiser,assassin,tank)
//   --runs N          runs per map (default 1)
//   --prestige N      every prestige upgrade at rank N for all bots (default 0)
//   --skill 0..1      how sharp the bots are (default 0.8)
//   --boss-time S     final boss arrives after S seconds (default: the real timer)
//   --god             bots can't die (they take damage but stop at 1 HP), so every run reaches the boss;
//                     "near-deaths" counts how often they'd have gone down
//   --log             print the run's progress every minute
//
// The bots play decently but below a good human, so compare runs against each other (before/after a
// change, hero vs hero) rather than reading the absolute survival times literally.

import { CHARACTERS, isCharacterId, type CharacterId } from '../src/shared/characters';
import { MAPS } from '../src/shared/maps';
import { PRESTIGE_IDS } from '../src/shared/prestige';
import { EVOLVED_LEVEL } from '../src/shared/upgrades';
import { Game, type Profile } from '../src/server/game';
import { Bot } from './bot';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const heroes = arg('heroes', 'mage,bruiser,assassin,tank')
  .split(',')
  .map((h) => h.trim());
for (const h of heroes) {
  if (!isCharacterId(h)) {
    console.error(`Unknown hero "${h}". Heroes: ${Object.keys(CHARACTERS).join(', ')}`);
    process.exit(1);
  }
}
const mapArg = arg('map', '0');
const maps = mapArg === 'all' ? MAPS.map((_, i) => i) : [Number(mapArg)];
const runs = Number(arg('runs', '1'));
const prestige = Number(arg('prestige', '0'));
const skill = Number(arg('skill', '0.8'));
const bossTime = arg('boss-time', '') ? Number(arg('boss-time', '')) : undefined;
const log = flag('log');
const god = flag('god');

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const k = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

interface HeroTotals {
  runs: number;
  damageShare: number;
  downs: number;
  taken: number;
}
const totals = new Map<string, HeroTotals>();

for (const map of maps) {
  let wins = 0;
  for (let run = 1; run <= runs; run++) {
    const ranks = Object.fromEntries(PRESTIGE_IDS.map((id) => [id, prestige]));
    const profiles: Record<string, Profile> = {};
    const bots: Bot[] = [];
    const game = new Game({ unlocked: MAPS.length, onUnlock: () => {}, bossTime, profiles, allHeroes: true });
    // Reach into the simulation only to measure; the bots themselves just see snapshots.
    const g = game as unknown as Record<string, any>;
    heroes.forEach((hero, i) => {
      // God mode is the server's "dev" name: damage still lands but never takes you below 1 HP.
      const name = god ? 'dev' : `bot${i + 1}`;
      profiles[name] = { points: 0, ranks };
      let bot: Bot | null = null;
      const id = game.addPlayer(name, hero, (text) => bot?.receive(text));
      if (id === null) throw new Error('Too many bots (4 max)');
      bot = new Bot((msg) => game.handleMessage(id, msg), id, skill);
      bots.push(bot);
    });
    game.handleMessage(bots[0].id, { t: 'map', index: map });
    game.handleMessage(bots[0].id, { t: 'start' });

    const downs = new Map<number, number>();
    const takenByMinute = new Map<number, number>();
    const lastTaken = new Map<number, number>();
    const wasDown = new Set<number>();
    let fightStart = -1;
    let peakEnemies = 0;
    let enemySum = 0;
    let samples = 0;
    let lastLog = 0;
    const started = performance.now();
    const limit = (bossTime ?? 540) + 900;
    while (g.phase === 'playing' && g.time < limit) {
      for (const bot of bots) bot.think();
      game.tick();
      for (const p of g.players.values()) {
        // In god mode, hitting 1 HP is where you'd have gone down.
        const down = p.downed || (god && p.hp <= 1);
        if (down && !wasDown.has(p.id)) {
          downs.set(p.id, (downs.get(p.id) ?? 0) + 1);
          if (god) p.hp = g.stats(p).maxHp; // Back on your feet, as if revived.
        }
        if (down) wasDown.add(p.id);
        else wasDown.delete(p.id);
        const minute = Math.floor(g.time / 60);
        const taken = (takenByMinute.get(minute) ?? 0) + (p.damageTaken - (lastTaken.get(p.id) ?? 0));
        takenByMinute.set(minute, taken);
        lastTaken.set(p.id, p.damageTaken);
      }
      if (g.bossPhase === 'fight' && fightStart < 0) fightStart = g.time;
      if (g.tickCount % 30 === 0) {
        peakEnemies = Math.max(peakEnemies, g.enemies.length);
        enemySum += g.enemies.length;
        samples++;
      }
      if (log && g.time - lastLog >= 60) {
        lastLog = g.time;
        const status = [...g.players.values()].map((p: any) => `${p.character} ${Math.ceil(p.hp)}/${g.stats(p).maxHp}${p.downed ? ' DOWN' : ''}`).join(', ');
        console.log(`  ${fmt(g.time)} lv${g.level} enemies ${g.enemies.length} | ${status}`);
      }
    }

    const result = g.result;
    const victory = !!result?.victory;
    if (victory) wins++;
    const players = [...g.players.values()];
    const totalDamage = players.reduce((s: number, p: any) => s + p.damageDealt, 0) || 1;
    const fight = fightStart >= 0 ? ` | boss fight ${fmt(g.time - fightStart)}${g.berserk ? `, berserk x${g.berserk}` : ''}` : '';
    console.log(
      `\n${MAPS[map].name}, run ${run}: ${victory ? 'VICTORY' : result ? 'DEFEAT' : 'TIMED OUT'} at ${fmt(g.time)}, level ${g.level}${fight}` +
        ` | enemies avg ${Math.round(enemySum / Math.max(1, samples))}, peak ${peakEnemies} | ${((performance.now() - started) / 1000).toFixed(1)}s`,
    );
    const perMinute = [...takenByMinute.entries()].map(([m, t]) => `${m + 1}:${k(t / players.length)}`);
    console.log(`  damage taken per player, by minute: ${perMinute.join(' ')}`);
    for (const p of players) {
      const evolved = Object.values(p.upgrades as Record<string, number>).filter((l) => l >= EVOLVED_LEVEL).length;
      const share = p.damageDealt / totalDamage;
      const hero = CHARACTERS[p.character as CharacterId];
      console.log(
        `  ${`${hero.name} (${p.character})`.padEnd(26)} dmg ${k(p.damageDealt).padStart(6)} (${Math.round(share * 100).toString().padStart(2)}%)` +
          `  taken ${k(p.damageTaken).padStart(5)}  ${god ? 'near-deaths' : 'downs'} ${downs.get(p.id) ?? 0}  kills ${String(p.kills).padStart(5)}  evolved ${evolved}`,
      );
      const t = totals.get(p.character) ?? { runs: 0, damageShare: 0, downs: 0, taken: 0 };
      t.runs++;
      t.damageShare += share * players.length; // 1.0 = an even share of the team's damage.
      t.downs += downs.get(p.id) ?? 0;
      t.taken += p.damageTaken;
      totals.set(p.character, t);
    }
  }
  if (runs > 1) console.log(`\n${MAPS[map].name}: won ${wins} of ${runs}`);
}

if (totals.size > 1 || runs > 1) {
  console.log('\nPer hero (damage: 1.0 = an even share of the team):');
  for (const [hero, t] of totals) {
    console.log(`  ${hero.padEnd(14)} damage x${(t.damageShare / t.runs).toFixed(2)}  downs/run ${(t.downs / t.runs).toFixed(1)}  taken/run ${k(t.taken / t.runs)}`);
  }
}
