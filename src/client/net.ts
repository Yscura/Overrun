import type { ArtifactId } from '../shared/artifacts';
import type { ClientMessage, ProfileState, RoomInfo, RoomRef, ServerMessage, Snapshot } from '../shared/protocol';

/**
 * The connection to the server. It's opened once at startup (the menu talks to the server too) and reconnects on
 * its own if it drops.
 */
export class Connection {
  onOpen: () => void = () => {};
  onWelcome: (id: number, room: RoomRef) => void = () => {};
  onLeft: () => void = () => {};
  onProfile: (profile: ProfileState) => void = () => {};
  /** How logging in went (see the 'auth' message). */
  onAuth: (result: { ok: true; name: string; token: string; created: boolean } | { ok: false; message: string }) => void = () => {};
  onRooms: (rooms: RoomInfo[]) => void = () => {};
  onError: (message: string) => void = () => {};
  /** What combining or the wheel gave you. */
  onArtifact: (id: ArtifactId, how: 'combine' | 'spin' | 'orb') => void = () => {};
  onSnapshot: (snap: Snapshot) => void = () => {};
  onClosed: () => void = () => {};

  private ws: WebSocket | null = null;

  connect(): void {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${location.host}/ws`);
    ws.onopen = () => this.onOpen();
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as ServerMessage;
      switch (msg.t) {
        case 'snap':
          this.onSnapshot(msg);
          break;
        case 'build': {
          // The host was rebuilt since this page loaded (it reconnected to a newer server): load the new game, or
          // the two would disagree about what's in a message. (Not on the dev server, which serves no build.)
          const mine = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src');
          if (msg.script && mine && mine.includes('/assets/') && mine !== msg.script) location.reload();
          break;
        }
        case 'welcome':
          this.onWelcome(msg.id, msg.room);
          break;
        case 'left':
          this.onLeft();
          break;
        case 'profile':
          this.onProfile(msg.profile);
          break;
        case 'auth':
          this.onAuth(msg);
          break;
        case 'rooms':
          this.onRooms(msg.rooms);
          break;
        case 'error':
          this.onError(msg.message);
          break;
        case 'artifact':
          this.onArtifact(msg.id, msg.how);
          break;
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.onClosed();
      setTimeout(() => this.connect(), 2000); // Try again.
    };
    this.ws = ws;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
