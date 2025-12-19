import type { TlclaApi } from "../../shared/tlcla";

declare global {
  interface Window {
    tlcla?: TlclaApi;
  }
}

export {};

