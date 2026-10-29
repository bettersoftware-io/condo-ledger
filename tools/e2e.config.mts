import { type E2eConfig, OUT_DIR } from "./e2e/lib/config.mts";

// What `pnpm e2e` builds, starts and runs. This file is the project's: add a
// mode, or change a command, here. The runner is in tools/e2e and belongs to
// the add-on.
//
// A command is the program and its arguments, never `pnpm …`: a package
// manager's wrapper can die on the stop signal while the server it started
// lives on. Every address is printed by the program that owns it and read
// from its `ready` line, so no port is written down here.
//
// A mode's `env` may name the server two ways. `SERVER_URL` is the address
// as the server printed it. `SERVER_HOST` (import it beside `SERVER_URL`) is
// its host and port alone, for a server that answers a second protocol on
// the same port: `VITE_API_URL: \`http://${SERVER_HOST}\``.
const config: E2eConfig = {
  // The package that holds the specs. The specs of a mode are in src/<mode>/.
  tests: "packages/e2e",

  client: {
    cwd: "packages/client-react",
    // A production build, not the dev server: it is what ships, and a page
    // loads as a few files instead of one request for each module.
    build: ["node_modules/.bin/vite", "build", "--outDir", OUT_DIR, "--emptyOutDir"],
    // Vite takes the next free port when its own is taken, and prints the one it got.
    serve: ["node_modules/.bin/vite", "preview", "--outDir", OUT_DIR, "--host", "127.0.0.1"],
    ready: /Local:\s+(http:\/\/[^\s/]+)/,
  },

  modes: {
    // The client alone, on its in-browser simulator. The variable is set to
    // nothing so that one left in the shell cannot point it at a server.
    sim: {
      env: { VITE_SERVER_URL: "" },
    },

    // The client against the real server comes with M3, when the server
    // serves the ports: the add-on's "fullstack" mode, in
    // tools/templates/e2e.tools__e2e.config.mts.txt, is the shape to copy.
    // architecture.config.mts says why until then (serversWithoutEndToEnd).
  },
};

export default config;
