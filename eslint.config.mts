import { architectureLint } from "./tools/arch/eslint.config.mts";

// `old/` is the archived legacy application and the first prototype; `docs/`
// holds the design prototype. Neither is code of this project.
export default [{ ignores: ["tools/**", "old/**", "docs/**"] }, ...architectureLint()];
