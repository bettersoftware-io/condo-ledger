import type { AddressInfo } from "node:net";

import { WebSocketServer } from "ws";

import { encodeReady, WS_PATH } from "@cl/shared";

export interface ServerOptions {
  /** 0 picks a free port. */
  port: number;
}

export interface RunningServer {
  port: number;
  close: () => Promise<void>;
}

/**
 * Greets every client that connects, once. The server's ports arrive on this
 * channel in M3.
 */
export function startServer({ port }: ServerOptions): Promise<RunningServer> {
  const server = new WebSocketServer({ port, path: WS_PATH });

  server.on("connection", (socket) => {
    socket.send(JSON.stringify(encodeReady()));

    // Without a listener, one client's protocol error would end the process.
    socket.on("error", () => {
      socket.terminate();
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", () => {
      resolve({
        // A server listening on a TCP port always reports an address object.
        port: (server.address() as AddressInfo).port,
        close: () => {
          return new Promise<void>((closed) => {
            for (const client of server.clients) {
              client.terminate();
            }

            server.close(() => {
              closed();
            });
          });
        },
      });
    });
  });
}
