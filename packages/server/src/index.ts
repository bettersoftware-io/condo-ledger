import { WS_PATH } from "@cl/shared";

import { type RunningServer, startServer } from "./startServer.ts";

// The server's composition root: read the configuration, start.
const server: RunningServer = await startServer({
  port: Number(process.env.PORT ?? 4000),
});

console.info(`server listening on ws://localhost:${server.port}${WS_PATH}`);
