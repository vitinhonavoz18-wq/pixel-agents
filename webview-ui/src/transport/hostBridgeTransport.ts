import { TRANSPORT_STATE_CONNECTED } from '../../../core/src/constants.js';
import type { ClientMessage, ServerMessage } from '../../../core/src/messages.js';
import type { MessageTransport, TransportState } from './types.js';

/** Envelope marker so the office ignores unrelated postMessage traffic. */
export const AGENCY_BRIDGE_MARKER = '__pixelAgency';

interface BridgeEnvelope {
  [AGENCY_BRIDGE_MARKER]: 1;
  message: ServerMessage | ClientMessage;
}

interface ReactNativeWebViewBridge {
  postMessage(data: string): void;
}

declare global {
  interface Window {
    ReactNativeWebView?: ReactNativeWebViewBridge;
    /** Called by the React Native host via `injectJavaScript` (most reliable path on Android). */
    __pixelAgencyDeliver?: (message: ServerMessage | string) => void;
  }
}

function parseEnvelope(data: unknown): ServerMessage | null {
  let value = data;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const env = value as Partial<BridgeEnvelope>;
  if (env[AGENCY_BRIDGE_MARKER] !== 1 || !env.message || typeof env.message !== 'object') {
    return null;
  }
  return typeof (env.message as { type?: unknown }).type === 'string'
    ? (env.message as ServerMessage)
    : null;
}

/**
 * Transport for the office embedded in the Pixel Agency app.
 *
 * Receives `ServerMessage`s from the host (iframe parent `postMessage`, React
 * Native WebView `postMessage`, or `window.__pixelAgencyDeliver`) and sends
 * `ClientMessage`s back the same way. Like `PostMessageTransport` it has no
 * connection lifecycle, so it reports `connected` for its whole lifetime.
 */
export class HostBridgeTransport implements MessageTransport {
  readonly state: TransportState = TRANSPORT_STATE_CONNECTED;
  readonly ready: Promise<void> = Promise.resolve();
  private handlers: Array<(msg: ServerMessage) => void> = [];
  /** Sends held until the bundled assets are delivered (see markBooted). */
  private outbox: ClientMessage[] | null = [];
  private readonly listener = (e: Event): void => {
    const msg = parseEnvelope((e as MessageEvent).data);
    if (msg) this.deliver(msg);
  };

  constructor() {
    window.addEventListener('message', this.listener);
    // Android's react-native-webview dispatches host messages on `document`.
    document.addEventListener('message', this.listener);
    window.__pixelAgencyDeliver = (message) => {
      const msg =
        typeof message === 'string'
          ? parseEnvelope(message)
          : parseEnvelope({ [AGENCY_BRIDGE_MARKER]: 1, message });
      if (msg) this.deliver(msg);
    };
  }

  /** Feed a message into the office as if it came from the host. */
  deliver(msg: ServerMessage): void {
    for (const handler of this.handlers) handler(msg);
  }

  /**
   * Release sends held since construction (notably `webviewReady`). Called by
   * the agency entry after it delivers the bundled assets + default layout, so
   * the host's reply (a saved layout, the agent roster) always lands on top.
   */
  markBooted(): void {
    const held = this.outbox ?? [];
    this.outbox = null;
    for (const msg of held) this.post(msg);
  }

  send(message: ClientMessage): void {
    if (this.outbox) {
      this.outbox.push(message);
      return;
    }
    this.post(message);
  }

  private post(message: ClientMessage): void {
    const envelope: BridgeEnvelope = { [AGENCY_BRIDGE_MARKER]: 1, message };
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(envelope));
    } else if (window.parent && window.parent !== window) {
      window.parent.postMessage(envelope, '*');
    }
  }

  onMessage(handler: (message: ServerMessage) => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  onStateChange(): () => void {
    return () => {};
  }

  dispose(): void {
    window.removeEventListener('message', this.listener);
    document.removeEventListener('message', this.listener);
    delete window.__pixelAgencyDeliver;
    this.handlers = [];
  }
}
