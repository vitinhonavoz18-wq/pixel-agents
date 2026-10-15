// Must be the FIRST import of the agency entry: runtime.ts reads this flag at
// module evaluation to route the transport to HostBridgeTransport.
(window as unknown as { __PIXEL_AGENCY_EMBED__?: boolean }).__PIXEL_AGENCY_EMBED__ = true;

export {};
