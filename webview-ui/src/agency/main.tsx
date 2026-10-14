// Pixel Agency office entry. embedFlag MUST stay the first import.
import './embedFlag.js';
import '../index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import payload from 'virtual:pixel-agency-office-assets';

import App from '../App.tsx';
import { HostBridgeTransport } from '../transport/hostBridgeTransport.js';
import { transport } from '../transport/index.js';
import { bootMessages } from './officeAssets.js';

let booted = false;
window.__pixelAgencyBoot = () => {
  // StrictMode double-invokes effects in dev; assets must load exactly once.
  if (booted) return;
  booted = true;
  if (!(transport instanceof HostBridgeTransport)) return;
  for (const msg of bootMessages(payload)) transport.deliver(msg);
  // Only now tell the host we are ready, so a saved layout it sends in reply
  // lands AFTER the bundled default instead of being overwritten by it.
  transport.markBooted();
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
