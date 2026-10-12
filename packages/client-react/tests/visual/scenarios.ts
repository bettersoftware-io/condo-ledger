/**
 * One picture: a name and the state the screen is in when it is taken. The
 * state is data, never a click. The visual host turns it into deliveries on
 * the app harness, so the real presenters decide what the screen looks like.
 */
export interface Scenario {
  /** The colour mode, set as the person would set it; the session's default when absent. */
  mode?: "light" | "dark";
}

/**
 * Every scenario, keyed by name. The name is the golden's file name
 * (`goldens/<platform>/<name>.png`) and the test's title, so keep it short,
 * lower-case and dashed. Each scenario needs a golden on every platform that
 * runs the tier; `pnpm visual` says which are missing. None until the
 * Accounts screen is drawn.
 */
export const scenarios: Record<string, Scenario> = {};
