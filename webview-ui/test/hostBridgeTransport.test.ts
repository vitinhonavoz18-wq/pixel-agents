/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ServerMessage } from '../../core/src/messages.js';
import { AGENCY_BRIDGE_MARKER } from '../src/transport/hostBridgeTransport.js';

type BridgeWindow = EventTarget & {
  ReactNativeWebView?: { postMessage(data: string): void };
  parent?: unknown;
  __pixelAgencyDeliver?: (m: unknown) => void;
};

let posted: string[];

beforeEach(() => {
  posted = [];
  const win = new EventTarget() as BridgeWindow;
  win.parent = win;
  win.ReactNativeWebView = { postMessage: (d) => posted.push(d) };
  (globalThis as unknown as { window: BridgeWindow }).window = win;
  (globalThis as unknown as { document: EventTarget }).document = new EventTarget();
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { document?: unknown }).document;
});

async function makeTransport() {
  const { HostBridgeTransport } = await import('../src/transport/hostBridgeTransport.js');
  return new HostBridgeTransport();
}

describe('HostBridgeTransport (Pixel Agency embed)', () => {
  it('holds sends until the bundled assets are booted, then posts envelopes to the RN host', async () => {
    const t = await makeTransport();
    t.send({ type: 'webviewReady' });
    expect(posted).toHaveLength(0);
    t.markBooted();
    expect(posted).toHaveLength(1);
    expect(JSON.parse(posted[0])).toEqual({
      [AGENCY_BRIDGE_MARKER]: 1,
      message: { type: 'webviewReady' },
    });
    t.send({ type: 'focusAgent', id: 3 });
    expect(JSON.parse(posted[1]).message).toEqual({ type: 'focusAgent', id: 3 });
    t.dispose();
  });

  it('delivers host messages from postMessage envelopes, document events and the injected global', async () => {
    const t = await makeTransport();
    const got: ServerMessage[] = [];
    t.onMessage((m) => got.push(m));
    const env = { [AGENCY_BRIDGE_MARKER]: 1, message: { type: 'agentClosed', id: 1 } };

    window.dispatchEvent(Object.assign(new Event('message'), { data: env }));
    // Android react-native-webview delivers a JSON string on `document`.
    document.dispatchEvent(Object.assign(new Event('message'), { data: JSON.stringify(env) }));
    window.__pixelAgencyDeliver?.({ type: 'agentClosed', id: 2 } as ServerMessage);

    expect(got).toEqual([
      { type: 'agentClosed', id: 1 },
      { type: 'agentClosed', id: 1 },
      { type: 'agentClosed', id: 2 },
    ]);
    t.dispose();
  });

  it('ignores unrelated or malformed postMessage traffic', async () => {
    const t = await makeTransport();
    const got: ServerMessage[] = [];
    t.onMessage((m) => got.push(m));
    for (const data of [
      { type: 'agentClosed', id: 1 }, // no envelope marker
      'not json',
      { [AGENCY_BRIDGE_MARKER]: 1, message: { id: 1 } }, // no type
      null,
    ]) {
      window.dispatchEvent(Object.assign(new Event('message'), { data }));
    }
    expect(got).toEqual([]);
    t.dispose();
  });
});
