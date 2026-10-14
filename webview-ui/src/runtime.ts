/**
 * Runtime detection, provider-agnostic
 *
 * Single source of truth for determining whether the webview is running
 * inside an IDE extension (VS Code, Cursor, Windsurf, etc.) or standalone
 * in a browser.
 */

declare function acquireVsCodeApi(): unknown;

type Runtime = 'vscode' | 'browser';
// Future: 'cursor' | 'windsurf' | 'electron' | etc.

const runtime: Runtime = typeof acquireVsCodeApi !== 'undefined' ? 'vscode' : 'browser';

export const isBrowserRuntime = runtime === 'browser';

/**
 * True when the office is embedded by the Pixel Agency app (React Native
 * WebView on Android, or an iframe on the web). The embedding host drives the
 * office over `HostBridgeTransport` and owns everything outside the canvas, so
 * desktop-only chrome (toolbar, hooks consent, changelog) is hidden. Set by
 * `src/agency/embedFlag.ts` before any other module evaluates.
 */
export const isAgencyEmbed: boolean =
  typeof window !== 'undefined' &&
  (window as unknown as { __PIXEL_AGENCY_EMBED__?: boolean }).__PIXEL_AGENCY_EMBED__ === true;

/**
 * True only under the Playwright e2e harness, which sets `__PIXEL_AGENTS_E2E`
 * via `addInitScript` before any app code runs (so it's set in every frame,
 * including the VS Code webview iframe). Gates test-only diagnostics
 * (window.__pixelAgentsTestHooks message/sound logs, the addAgent wrapper) so
 * they never run, and never grow unbounded, in a real user's session.
 */
export const isE2E: boolean =
  typeof window !== 'undefined' &&
  (window as unknown as { __PIXEL_AGENTS_E2E?: boolean }).__PIXEL_AGENTS_E2E === true;
