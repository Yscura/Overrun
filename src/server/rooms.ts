// Rooms: each lobby on the server is a room with its own Game and a short code friends can join with.

import { MAX_PLAYERS } from '../shared/constants';
import { MODES, type ModeId } from '../shared/modes';
import type { RoomInfo, RoomRef } from '../shared/protocol';
import { Game } from './game';

export interface Room extends RoomRef {
  game: Game;
}

// No I or O, so codes are easy to read out.
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 4;

export class Rooms {
  private rooms = new Map<string, Room>();

  constructor(private readonly makeGame: (room: RoomRef) => Game) {}

  create(mode: ModeId): Room {
    let code = '';
    do {
      code = Array.from({ length: CODE_LENGTH }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
    } while (this.rooms.has(code));
    const ref = { code, mode };
    const room = { ...ref, game: this.makeGame(ref) };
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.trim().toUpperCase());
  }

  /** Why someone can't join this room right now, or null if they can. */
  joinProblem(room: Room | undefined): string | null {
    if (!room) return 'No lobby with that code.';
    if (!MODES[room.mode].joinable) return 'That game is private.';
    if (room.game.humanCount >= MODES[room.mode].maxHumans || room.game.playerCount >= MAX_PLAYERS) return 'That lobby is full.';
    return null;
  }

  /** Closes a room once everyone has left. */
  removeIfEmpty(room: Room): void {
    if (room.game.humanCount === 0) this.rooms.delete(room.code);
  }

  /** Open lobbies anyone can join, for the multiplayer browser. */
  list(): RoomInfo[] {
    return [...this.rooms.values()]
      .filter((r) => this.joinProblem(r) === null)
      .map((r) => ({
        code: r.code,
        mode: r.mode,
        host: r.game.hostName,
        players: r.game.playerCount,
        humans: r.game.humanCount,
        maxHumans: MODES[r.mode].maxHumans,
        phase: r.game.currentPhase,
        map: r.game.currentMap,
      }));
  }

  all(): Iterable<Room> {
    return this.rooms.values();
  }

  tick(): void {
    for (const room of this.rooms.values()) room.game.tick();
  }
}
