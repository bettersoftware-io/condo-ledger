export const WS_PATH = "/ws";

const SERVER_MSG = { READY: "ready" } as const;

/** The server's greeting: sent once to each client that connects. The nine ports arrive on this channel in M3. */
export interface ReadyMessage {
  type: typeof SERVER_MSG.READY;
}

export type ServerMessage = ReadyMessage;

export function encodeReady(): ReadyMessage {
  return { type: SERVER_MSG.READY };
}

/** The message, if `raw` is one this protocol knows; otherwise undefined. */
export function parseServerMessage(raw: unknown): ServerMessage | undefined {
  if (!isRecord(raw) || raw.type !== SERVER_MSG.READY) {
    return undefined;
  }

  return { type: SERVER_MSG.READY };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
