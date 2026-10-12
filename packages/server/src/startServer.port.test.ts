import { connect } from "node:net";

import { describe, expect, it, onTestFinished } from "vitest";

import { WS_PATH } from "@cl/shared";

import { type RunningServer, startServer } from "./startServer.ts";

describe("the server", () => {
  it("greets a client that connects", async () => {
    const server = await startTestServer();
    const client = openClient(server.port);

    const greeting = await client.nextMessage();

    expect(greeting).toEqual({ type: "ready" });
  });

  it("greets each client once", async () => {
    const server = await startTestServer();
    const first = openClient(server.port);
    const second = openClient(server.port);

    await Promise.all([first.nextMessage(), second.nextMessage()]);
    await Promise.all([first.close(), second.close()]);

    expect([first.messages.length, second.messages.length]).toEqual([1, 1]);
  });

  it("closes every client when it closes", async () => {
    const server = await startTestServer();
    const client = openClient(server.port);
    await client.nextMessage();
    const closed = client.closed();

    await server.close();

    await expect(closed).resolves.toBeUndefined();
  });

  it("drops a client that breaks the protocol, and keeps serving the others", async () => {
    const server = await startTestServer();

    await breakTheProtocol(server.port);

    const healthy = openClient(server.port);

    expect(await healthy.nextMessage()).toEqual({ type: "ready" });
  });

  it("picks a free port when asked for 0", async () => {
    const server = await startTestServer();

    expect(server.port).toBeGreaterThan(0);
  });
});

/** A server on a free port, closed when the test ends. */
async function startTestServer(): Promise<RunningServer> {
  const server = await startServer({ port: 0 });

  onTestFinished(() => {
    return server.close();
  });

  return server;
}

/**
 * Connects by hand and sends a frame no WebSocket client may send: one that is
 * not masked. Resolves when the server has dropped the connection.
 */
function breakTheProtocol(port: number): Promise<void> {
  const UNMASKED_TEXT_FRAME = Buffer.from([0x81, 0x01, 0x61]);
  const socket = connect(port, "localhost");

  socket.write(
    [
      `GET ${WS_PATH} HTTP/1.1`,
      `Host: localhost:${port}`,
      "Upgrade: websocket",
      "Connection: Upgrade",
      "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
      "Sec-WebSocket-Version: 13",
      "",
      "",
    ].join("\r\n"),
  );
  socket.once("data", () => {
    socket.write(UNMASKED_TEXT_FRAME);
  });

  return new Promise((dropped) => {
    socket.once("close", () => {
      dropped();
    });
  });
}

interface TestClient {
  messages: unknown[];
  nextMessage: () => Promise<unknown>;
  closed: () => Promise<void>;
  close: () => Promise<void>;
}

/** Connects at once and keeps every message it receives. */
function openClient(port: number): TestClient {
  const socket = new WebSocket(`ws://127.0.0.1:${port}${WS_PATH}`);
  const messages: unknown[] = [];
  const waiting: Array<(message: unknown) => void> = [];

  socket.addEventListener("message", (event) => {
    const message: unknown = JSON.parse(String(event.data));
    messages.push(message);
    waiting.shift()?.(message);
  });

  function whenClosed(): Promise<void> {
    return new Promise((done) => {
      if (socket.readyState === WebSocket.CLOSED) {
        done();

        return;
      }

      socket.addEventListener("close", () => {
        done();
      });
    });
  }

  return {
    messages,
    nextMessage: () => {
      return new Promise((received) => {
        waiting.push(received);
      });
    },
    closed: whenClosed,
    close: () => {
      const done = whenClosed();
      socket.close();

      return done;
    },
  };
}
