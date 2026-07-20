import type { GearContentStudioApi } from "../shared/types";

declare global {
  interface Window {
    gearContentStudio: GearContentStudioApi;
  }
}

export {};
