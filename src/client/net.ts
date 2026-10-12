import type { CharacterId } from '../shared/characters';
import type { ClientMessage, ServerMessage, Snapshot } from '../shared/protocol';

export class Connection {
  onWelcome: (id: number) => void = () => {};
  onSnapshot: (snap: Snapshot) => void = () => {};
  onClosed: (reason: string) => void = () => {};

  private ws: WebSocket | null = null;

  connect(name: string, character: CharacterId): void {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${location.host}/ws`);
    let reason = 'Disconnected from the server.';
    ws.onopen = () => this.send({ t: 'join', name, character });
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as ServerMessage;
      if (msg.t === 'snap') this.onSnapshot(msg);
      else if (msg.t === 'welcome') this.onWelcome(msg.id);
      else if (msg.t === 'full') reason = 'The game is full (4 players max).';
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.onClosed(reason);
    };
    this.ws = ws;
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
