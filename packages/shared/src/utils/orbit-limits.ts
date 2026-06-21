import type { Orbit, TrackSource } from "../types/index.js";

export const ORBIT_TEST_PHASE_LIMIT_MESSAGE =
  "Orbit is still in test phase and not in full development yet - usage is limited to one list orbit and one keyword orbit.";

/** Returns an error message if this wallet cannot create another orbit of the given source. */
export function getOrbitCreateLimitError(orbits: Orbit[], source: TrackSource): string | null {
  if (source === "list" && orbits.some((o) => o.source === "list")) {
    return ORBIT_TEST_PHASE_LIMIT_MESSAGE;
  }
  if (source === "custom" && orbits.some((o) => o.source === "custom")) {
    return ORBIT_TEST_PHASE_LIMIT_MESSAGE;
  }
  return null;
}
