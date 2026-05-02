export {};

declare global {
  interface Window {
    gtag?: (command: string, name: string, params?: Record<string, unknown>) => void;
  }
}
