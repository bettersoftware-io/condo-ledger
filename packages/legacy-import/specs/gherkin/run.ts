import { readdirSync, readFileSync } from "node:fs";

import { describe, it } from "vitest";

import { parseFeature, type Step } from "./parse.ts";

export type World = Record<string, unknown>;
type StepFn = (world: World, ...args: string[]) => void | Promise<void>;
interface Binding {
  re: RegExp;
  fn: StepFn;
}

const bindings: Binding[] = [];

/** Register a step. Keyword (Given/When/Then/And) is documentation; matching is by regex. */
export function defineStep(re: RegExp, fn: StepFn): void {
  bindings.push({ re, fn });
}

// The keywords the step files use. Each is its own function, not an alias of
// `defineStep`, so knip does not read them as one export under four names.
export function Given(re: RegExp, fn: StepFn): void {
  defineStep(re, fn);
}

export function When(re: RegExp, fn: StepFn): void {
  defineStep(re, fn);
}

export function Then(re: RegExp, fn: StepFn): void {
  defineStep(re, fn);
}

/** Test seam: clear the registry. */
export function resetSteps(): void {
  bindings.length = 0;
}

export async function runStep(world: World, step: Step): Promise<void> {
  for (const b of bindings) {
    const m = step.text.match(b.re);

    if (m) {
      await b.fn(world, ...m.slice(1));
      return;
    }
  }

  throw new Error(`Undefined step: ${step.text}`);
}

/** Read every .feature in `dir` and emit one Vitest test per scenario. */
export function runFeatureFiles(dir: string, makeWorld: () => World): void {
  const files = readdirSync(dir)
    .filter((f) => {
      return f.endsWith(".feature");
    })
    .sort();

  for (const file of files) {
    const feature = parseFeature(readFileSync(`${dir}/${file}`, "utf8"));
    describe(feature.name || file, () => {
      for (const sc of feature.scenarios) {
        it(sc.name, async () => {
          const world = makeWorld();

          for (const step of [...feature.background, ...sc.steps]) {
            await runStep(world, step);
          }
        });
      }
    });
  }
}
