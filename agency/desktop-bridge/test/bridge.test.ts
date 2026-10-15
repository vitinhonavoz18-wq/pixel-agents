import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DesktopBridge, readLocalServer } from '../src/bridge.js';
import { renderLine } from '../src/statusline.js';

describe('DesktopBridge', () => {
  it('reads the local Pixel Agents discovery file', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-'));
    expect(readLocalServer(home)).toBeNull();
    fs.mkdirSync(path.join(home, '.pixel-agents'));
    fs.writeFileSync(
      path.join(home, '.pixel-agents', 'server.json'),
      JSON.stringify({ port: 3100, authToken: 't' }),
    );
    expect(readLocalServer(home)).toEqual({ port: 3100, authToken: 't' });
  });

  it('forwards only lifecycle/activity messages and retries failed batches', async () => {
    const calls: unknown[] = [];
    let fail = true;
    const bridge = new DesktopBridge({
      agencyUrl: 'https://agency.example',
      bridgeToken: 'tok',
      log: () => {},
      fetchFn: (async (_url: URL, init: RequestInit) => {
        calls.push(JSON.parse(String(init.body)));
        return new Response('{}', { status: fail ? 500 : 200 });
      }) as typeof fetch,
    });
    expect(bridge.accept({ type: 'agentCreated', id: 1 })).toBe(true);
    expect(bridge.accept({ type: 'layoutLoaded', layout: null })).toBe(false);
    expect(await bridge.flush()).toBe(0);
    fail = false;
    expect(await bridge.flush()).toBe(1);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual({ messages: [{ type: 'agentCreated', id: 1 }] });
  });

  it('advances the command cursor', async () => {
    const urls: string[] = [];
    const bridge = new DesktopBridge({
      agencyUrl: 'https://agency.example',
      bridgeToken: 'tok',
      log: () => {},
      fetchFn: (async (url: URL) => {
        urls.push(url.toString());
        return new Response(JSON.stringify([{ id: 4, type: 'focusAgent', id2: 0 }]), {
          status: 200,
        });
      }) as typeof fetch,
    });
    await bridge.pollCommands();
    await bridge.pollCommands();
    expect(urls[1]).toContain('after=4');
  });
});

describe('statusline', () => {
  it('renders official rate limits', () => {
    const now = Date.parse('2026-10-15T00:00:00Z');
    const line = renderLine(
      {
        model: { display_name: 'Opus' },
        rate_limits: {
          five_hour: { used_percentage: 69.2, resets_at: now / 1000 + 9720 },
          seven_day: { used_percentage: 52 },
        },
      },
      now,
    );
    expect(line).toBe('PIXEL AGENCY · Opus · sessão 69% (2 h 42 min) · semana 52%');
  });
});
