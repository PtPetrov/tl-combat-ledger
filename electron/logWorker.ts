import { parentPort, workerData } from "node:worker_threads";
import { parseLogFileSummary } from "./logs";
import type { ParsedLogSummary } from "../shared/types";

type WorkerPayload = {
  filePath: string;
};

const port = parentPort;

if (!port) {
  throw new Error("logWorker must be run as a worker thread");
}

const { filePath } = workerData as WorkerPayload;

const run = async () => {
  try {
    const summary: ParsedLogSummary = await parseLogFileSummary(filePath);
    port.postMessage({ status: "success", summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    port.postMessage({ status: "error", error: message });
  }
};

run();
