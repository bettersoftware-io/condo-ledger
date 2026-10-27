import { legacySeedData } from "../simulators/seed/legacySeed.generated.ts";
import { loadLegacySeed } from "../simulators/seed/legacySeed.ts";
import type { AllocationSource } from "../useCases/allocation/allocation.ts";
import { allocationSourceOf } from "../useCases/allocation/allocationSource.ts";

/** One period of the committed seed, as the allocation reads it from the ports. */
export function createSeedAllocationSource(periodId: string): AllocationSource {
  return allocationSourceOf(seed, periodId);
}

const seed = loadLegacySeed(legacySeedData);
