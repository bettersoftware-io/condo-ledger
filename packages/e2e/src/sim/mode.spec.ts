import { expect, test } from "#/testing/test.ts";

test.describe("the light and dark modes, on the simulator", () => {
  test("draws the whole app in dark mode when it is switched on, and in light mode again when it is switched off", async ({
    shell,
  }) => {
    await shell.open();
    await expect.poll(shell.mode).toBe("light");

    await shell.toggleMode();
    await expect.poll(shell.mode).toBe("dark");

    await shell.toggleMode();
    await expect.poll(shell.mode).toBe("light");
  });
});
