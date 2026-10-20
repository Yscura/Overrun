// The chat and event log: a semi-transparent box in the bottom-left corner. Events (boss arrivals, upgrade
// points, players going down...) and chat messages show up with a timestamp. Enter opens the input, Enter sends,
// Escape cancels. It fades back when nothing's happening.

import { CHAT_MAX, type LogTone } from '../shared/protocol';

const MAX_LINES = 60;
/** Seconds after the last new line before the box fades back. */
const FADE_AFTER = 8;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export class Chat {
  onSend: (text: string) => void = () => {};

  private box = $('chat');
  private lines = $('chat-log');
  private input = $<HTMLInputElement>('chat-input');
  private fadeTimer = 0;

  constructor() {
    this.input.maxLength = CHAT_MAX;
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // Typing never moves your hero or opens the scoreboard.
      if (e.key === 'Enter') {
        const text = this.input.value.trim();
        if (text) this.onSend(text);
        this.close();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });
    this.input.addEventListener('blur', () => this.close());
  }

  /** Shown while you're in a room (lobby, game, results). */
  setVisible(visible: boolean): void {
    this.box.classList.toggle('hidden', !visible);
    if (!visible) {
      this.close();
      this.lines.replaceChildren();
    }
  }

  /** Put the chat in a panel (the lobby), or null for its usual corner of the screen. */
  dock(parent: HTMLElement | null): void {
    const home = parent ?? document.body;
    if (this.box.parentElement !== home) home.append(this.box);
    this.box.classList.toggle('docked', parent !== null);
    if (parent) this.box.classList.remove('idle');
  }

  get typing(): boolean {
    return document.activeElement === this.input;
  }

  open(): void {
    this.box.classList.add('typing');
    this.wake();
    this.input.focus();
  }

  close(): void {
    this.input.value = '';
    this.box.classList.remove('typing');
    if (document.activeElement === this.input) this.input.blur();
    this.wake();
  }

  /** An event line (from the game, in `color` if it has one) or a chat line (from a player). */
  add(time: string, text: string, tone: LogTone | 'chat', who?: { name: string; color: number }, color?: number): void {
    const line = document.createElement('div');
    line.className = `chat-line ${tone}`;
    if (color !== undefined) line.style.color = `#${color.toString(16).padStart(6, '0')}`;
    const stamp = document.createElement('span');
    stamp.className = 'chat-time';
    stamp.textContent = time;
    line.append(stamp);
    if (who) {
      const name = document.createElement('span');
      name.className = 'chat-name';
      name.textContent = `${who.name}:`;
      name.style.color = `#${who.color.toString(16).padStart(6, '0')}`;
      line.append(name);
    }
    line.append(document.createTextNode(` ${text}`)); // Text node: player messages are never treated as HTML.
    this.lines.append(line);
    while (this.lines.childElementCount > MAX_LINES) this.lines.firstElementChild!.remove();
    this.lines.scrollTop = this.lines.scrollHeight;
    this.wake();
  }

  /** Bright for a while, then fade back (unless you're typing). */
  private wake(): void {
    this.box.classList.remove('idle');
    clearTimeout(this.fadeTimer);
    this.fadeTimer = window.setTimeout(() => {
      if (!this.typing && !this.box.classList.contains('docked')) this.box.classList.add('idle');
    }, FADE_AFTER * 1000);
  }
}
