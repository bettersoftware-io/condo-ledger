import type { MockStoreSeed } from "./seed";
import raw from "./data.generated.json";

/** The full legacy dataset, assembled offline by `pnpm gen:data`. Money fields
 * serialize as `{ cents: number }` — structurally a `Money` — so the cast is sound. */
export const generatedSeed = raw as unknown as MockStoreSeed;
