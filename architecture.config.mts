import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { ArchitectureConfig } from "./tools/arch/gates/lib/config.mts";

// Every workspace package appears here with the role it plays. A package that
// is not listed fails the structure gate, so a new one cannot slip in without
// its rules.
//
// Role       May import
// domain     nothing
// leaf       nothing
// shared     domain, leaf
// core       domain, shared, leaf
// bindings   core, domain, leaf
// client     bindings, core, domain, leaf
// server     domain, shared, leaf
// explicit   only what its own mayImport names; and only a package that
//            names it in its mayImport imports it
// integration  every role above; nothing may import it, and it holds only tests
const config: ArchitectureConfig = {
  packages: {
    "packages/domain": { role: "domain", npm: ["rxjs"] },
    "packages/shared": { role: "shared", noNodeBuiltins: true },
    "packages/client-core": { role: "core", noNodeBuiltins: true },
    "packages/react-bindings": { role: "bindings", noNodeBuiltins: true },
    "packages/client-react": {
      role: "client",
      entry: ["main.tsx", "index.css", "*.d.ts"],
      noNodeBuiltins: true,
      reactCompiler: true,
      // The grid re-renders on every tree change; a row that did not change
      // is skipped only while the compiler memoizes it. The Journal grid's
      // rows are mapped afresh from the machine's on each render; memoized,
      // the mapping and the rows it hands the tree grid keep their identity.
      compilerTracked: [
        { file: "src/ui/TreeGridRow.tsx", fn: "TreeGridRow" },
        { file: "src/ui/journal/JournalGrid.tsx", fn: "JournalGrid" },
        { file: "src/ui/installments/ScheduleGrid.tsx", fn: "ScheduleGrid" },
      ],
    },
    "packages/server": { role: "server" },
    "packages/integration": { role: "integration" },
    // The legacy schema in Drizzle and the ETL that seeds Postgres from the
    // dumps. Imports no workspace package; the server imports it (M3).
    "packages/db": { role: "leaf" },
    // The offline generator: parses the legacy dump, projects it through the
    // domain engine, emits the simulator seed and runs the parity specs.
    // Node-side, so `server`: it may import the domain and the db leaf.
    "packages/legacy-import": { role: "server" },

    // A graph the roles above cannot draw ("the catalog imports the spec, and
    // only the runtime imports the catalog") is written edge by edge: the
    // role `explicit` grants nothing, and the edges are the mayImport lists.
    // `reactRules: "client"` (or "bindings") gives a package of that role the
    // React lint rules of a client (or the bindings); without it, a package
    // that imports React is listed under `reactWithoutPolicies`.
    // "packages/catalog": { role: "explicit", mayImport: ["packages/spec"], reactRules: "client" },
    // "packages/runtime": { role: "bindings", mayImport: ["packages/catalog"] },
  },

  adapters: [
    "packages/domain/src/simulators",
    "packages/client-core/src/adapters",
  ],

  vendorOnlyIn: {
    react: ["packages/react-bindings", "packages/client-react"],
    "react-dom": ["packages/react-bindings", "packages/client-react"],
    ws: ["packages/server"],
  },

  // The typescript-only gate walks the whole repository. These are not code
  // of the project: the archived legacy application (old/flex, old/prototype-web)
  // and the design prototype's own script.
  javascriptAllowed: {
    "docs/design/web/v1/support.js":
      "the design prototype's own script; a reference, not code of the project",
    ...archivedJavascript("old"),
  },
};

/** Every JavaScript file under an archive folder, each with the same reason. */
function archivedJavascript(folder: string): Record<string, string> {
  const files: string[] = [];

  // old/ is kept on one machine and is not in git: a fresh clone has no such folder.
  if (!existsSync(join(import.meta.dirname, folder))) {
    return {};
  }

  function walk(relative: string): void {
    for (const entry of readdirSync(join(import.meta.dirname, relative), {
      withFileTypes: true,
    })) {
      const path = `${relative}/${entry.name}`;

      if (entry.isDirectory() && entry.name !== "node_modules") {
        walk(path);
      } else if (/\.(js|jsx|mjs|cjs)$/.test(entry.name)) {
        files.push(path);
      }
    }
  }

  walk(folder);

  return Object.fromEntries(
    files.map((file) => {
      return [
        file,
        `archived under ${folder}/: the legacy application and the first prototype, kept for reference`,
      ];
    }),
  );
}

export default config;
