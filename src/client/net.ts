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
  onRooms: (rooms: RoomInfo[]) => void = () => {};
  onError: (message: string) => void = () => {};
  /** What combining or the wheel gave you. */
  onArtifact: (id: ArtifactId, how: 'combine' | 'spin') => void = () => {};
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
        case 'welcome':
          this.onWelcome(msg.id, msg.room);
          break;
        case 'left':
          this.onLeft();
          break;
        case 'profile':
          this.onProfile(msg.profile);
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
