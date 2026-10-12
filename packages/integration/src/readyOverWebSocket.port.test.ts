import { firstValueFrom, timeout } from "rxjs";
import { describe, expect, it, onTestFinished } from "vitest";

import { createWsConnection } from "@cl/client-core";
import { startServer } from "@cl/server/startServer.ts";
import { parseServerMessage, WS_PATH } from "@cl/shared";

// The client's connection adapter against the real server over a real socket:
// the one thing only this package may test. Each side's own tests stay with it.
describe("the client's connection against the real server", () => {
  it("receives the server's greeting, decoded by the shared protocol", async () => {
    const server = await startServer({ port: 0 });
    onTestFinished(server.close);
    const connection = createWsConnection(
      `ws://127.0.0.1:${server.port}${WS_PATH}`,
    );

    const first = await firstValueFrom(
      connection.messages().pipe(timeout(GIVE_UP_AFTER_MS)),
    );

    expect(parseServerMessage(first)).toEqual({ type: "ready" });
  });
});

// A deadline for the one wait that has no event to wait on.
const GIVE_UP_AFTER_MS = 2000;
