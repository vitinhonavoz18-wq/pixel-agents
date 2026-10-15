#!/usr/bin/env node
import { DesktopBridge } from './bridge.js';

const agencyUrl = process.env.AGENCY_URL;
const bridgeToken = process.env.AGENCY_BRIDGE_TOKEN;
if (!agencyUrl || !bridgeToken) {
  console.error(
    'Defina AGENCY_URL (ex.: https://agency.exemplo.com) e AGENCY_BRIDGE_TOKEN (token com escopo "bridge").',
  );
  process.exit(1);
}
const bridge = new DesktopBridge({ agencyUrl, bridgeToken });
bridge.start();
console.log(`[bridge] PIXEL AGENCY Desktop Bridge → ${agencyUrl}`);
process.on('SIGINT', () => {
  bridge.stop();
  process.exit(0);
});
