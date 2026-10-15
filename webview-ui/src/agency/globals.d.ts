export {};

declare global {
  interface Window {
    /** Set by the agency entry; App calls it once the message listener is live. */
    __pixelAgencyBoot?: () => void;
  }
}
