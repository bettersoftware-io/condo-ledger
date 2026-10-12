import { describe, expect, it } from "vitest";

import { mountTopBar } from "./TopBar.page.tsx";

describe("TopBar", () => {
  it("shows the account line", () => {
    const page = mountTopBar();

    expect(page.accountLine()).toBe(
      "Account marco · Ferrari Marco|Profile Administrator|Firm Studio Ferrari",
    );
  });

  it("toggles the mode on the root", async () => {
    const page = mountTopBar();

    expect(page.rootMode()).toBe("light");
    expect(page.modeLabel()).toBe("Switch to dark mode");

    await page.toggleMode();

    expect(page.rootMode()).toBe("dark");
    expect(page.modeLabel()).toBe("Switch to light mode");

    await page.toggleMode();

    expect(page.rootMode()).toBe("light");
  });

  it("picks a theme", async () => {
    const page = mountTopBar();

    expect(page.rootTheme()).toBe("slate");
    expect(page.themeLabel()).toBe("Slate");

    await page.openThemes();

    expect(page.options()).toEqual(["Slate ✓", "Carbon", "Sage"]);

    await page.pickTheme("Carbon");

    expect(page.rootTheme()).toBe("carbon");
    expect(page.themeLabel()).toBe("Carbon");
    expect(page.isPopoverOpen()).toBe(false);
  });

  it("picks a language", async () => {
    const page = mountTopBar();

    expect(page.languageLabel()).toBe("Language: English");

    await page.openLanguages();

    expect(page.options()).toEqual([
      "English ✓",
      "Italiano",
      "Français",
      "Deutsch",
      "Español",
    ]);

    await page.pickLanguage("Italiano");

    expect(page.languageLabel()).toBe("Language: Italiano");
    expect(page.isPopoverOpen()).toBe(false);
  });

  it("closes a popover on Escape", async () => {
    const page = mountTopBar();

    await page.openThemes();
    await page.pressEscape();

    expect(page.isPopoverOpen()).toBe(false);
    expect(page.rootTheme()).toBe("slate");
  });

  it("closes a popover on a click outside it", async () => {
    const page = mountTopBar();

    await page.openLanguages();
    await page.clickOutside();

    expect(page.isPopoverOpen()).toBe(false);
    expect(page.languageLabel()).toBe("Language: English");
  });

  it("says logging out is not yet available", async () => {
    const page = mountTopBar();

    await page.logOut();

    expect(page.toasts()).toEqual(["Log out: not yet available"]);
  });

  it("switches module tabs", async () => {
    const page = mountTopBar();

    expect(page.activeTab()).toBe("Buildings");
    expect(page.hasSidebar()).toBe(true);

    await page.clickTab("Calendar");

    expect(page.activeTab()).toBe("Calendar");
    expect(page.hasSidebar()).toBe(false);
    expect(page.placeholderTitle()).toBe("Calendar");

    await page.clickTab("Contacts");

    expect(page.placeholderTitle()).toBe("Contacts");
  });
});
