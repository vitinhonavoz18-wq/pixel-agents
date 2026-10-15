import { EventEmitter } from 'node:events';

import type { AgencyServerEvent } from '@pixel-agency/shared';

/** In-process fan-out of server events to WebSocket clients. */
export class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(500);
  }

  publish(event: AgencyServerEvent): void {
    this.emitter.emit('event', event);
  }

  subscribe(fn: (e: AgencyServerEvent) => void): () => void {
    this.emitter.on('event', fn);
    return () => this.emitter.off('event', fn);
  }
}
