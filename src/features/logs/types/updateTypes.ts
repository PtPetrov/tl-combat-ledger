export type UpdateStatusState =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export interface UpdateStatusPayload {
  state: UpdateStatusState;
  version?: string;
  percent?: number;
  message?: string;
}

export interface UpdatesApi {
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
  onStatus: (callback: (status: UpdateStatusPayload) => void) => () => void;
}
