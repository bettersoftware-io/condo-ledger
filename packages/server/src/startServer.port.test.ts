import { connect } from "node:net";

import { describe, expect, it, onTestFinished } from "vitest";
import { type RawData, WebSocket } from "ws";

import { WS_PATH } from "@cl/shared";

import { type RunningServer, startServer } from "./startServer.ts";

describe("the server", () => {
  it("greets a client that connects", async () => {
    const server = await startTestServer();
    const client = openClient(server.port);

    const greeting = await client.nextMessage();

    expect(greeting).toEqual({ type: "ready" });
  });

  it("greets each client once, and not again when another connects or when it speaks", async () => {
    const server = await startTestServer();
    const first = openClient(server.port);
    const second = openClient(server.port);

    await first.nextMessage();
    await second.nextMessage();
    first.send("hello");
    second.send("hello");
    await Promise.all([first.settled(), second.settled()]);

    expect([first.messages, second.messages]).toEqual([
      [{ type: "ready" }],
      [{ type: "ready" }],
    ]);
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
  /** Every message received so far, in order. */
  messages: unknown[];
  /** The first message not yet read, whether it landed before the call or lands after. */
  nextMessage: () => Promise<unknown>;
  send: (text: string) => void;
  /**
   * Pings the server and resolves on its pong. The server answers a ping
   * after every frame the client sent before it, and sends its pong after
   * everything it sent before, so whatever it sent until then is in
   * `messages`. (A WebSocket that closes from the client's side would drop
   * a message arriving while it closes.)
   */
  settled: () => Promise<void>;
  closed: () => Promise<void>;
}

/** Connects at once and keeps every message it receives. */
function openClient(port: number): TestClient {
  const socket = new WebSocket(`ws://127.0.0.1:${port}${WS_PATH}`);
  const messages: unknown[] = [];
  const waiting: Array<(message: unknown) => void> = [];
  let read = 0;

  socket.on("message", (data) => {
    messages.push(JSON.parse(textOf(data)));
    handOver();
  });

  /** Gives each waiting reader the next message nobody has read. */
  function handOver(): void {
    while (waiting.length > 0 && read < messages.length) {
      const message = messages[read];
      read += 1;
      waiting.shift()?.(message);
    }
  }

  return {
    messages,
    nextMessage: () => {
      return new Promise((received) => {
        waiting.push(received);
        handOver();
      });
    },
    send: (text: string) => {
      socket.send(text);
    },
    settled: () => {
      return new Promise((done) => {
        socket.once("pong", () => {
          done();
        });
        socket.ping();
      });
    },
    closed: () => {
      return new Promise((done) => {
        if (socket.readyState === WebSocket.CLOSED) {
          done();

          return;
        }

        socket.once("close", () => {
          done();
        });
      });
    },
  };
}

function textOf(data: RawData): string {
  return new TextDecoder().decode(
    Array.isArray(data) ? Buffer.concat(data) : data,
  );
}
