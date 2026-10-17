# Ideas

What is worth writing down before it is forgotten, and that nobody has
committed to: no plan, and it may never happen.

This page comes before [STATUS.md](STATUS.md). When an idea gets a plan, move
it there with a link to the plan. Do not leave it in both: this page holds
only what has not moved on. An idea that is dropped is removed; the git log
keeps it.

One bullet or one short section for each idea: what it is, and why it might
be worth doing. Not how.

- **Goldens for the carbon and sage themes.** The goldens show the slate
  theme in light and dark only; a theme regression would pass.
- **Maximize as an app-wide machine.** It is built once in `AppRoot` and
  passed down as a prop; moving it into the composition beside `navigation`
  would let any screen fold the sidebar without the prop chain.
- **`canEditBudget` on the account node.** The grid restates "which account
  takes a budget" (`nature === "expenses"` and an account scope); the domain
  already owns that rule in `validateBudget`.
- **Keyboard navigation in the tree and the menus.** Arrow keys in the grid
  rows, in the popover menus and across the tabs; today Enter and Space
  select a row and the caret is a button.
- **The language picker with an effect.** It stores the choice only; the
  chrome stays English and `parseAmount` refuses the Italian decimal comma.
- **A command that reports where the project stands** (branch, open pull
  requests, the last run on main) beside this page's headings. The plugin's
  source has one and has not brought it over.
- **A check on `docs/STATUS.md` itself**: that it has its six sections, that
  its date moved with an edit, that each linked file exists. The
  `repo-hygiene` add-on already checks the links.
- **Dragging a dialog by its title bar**, with the position kept per dialog
  id for the session, as the design describes; nothing depends on it.
- **An invoice split over several cost accounts.** The legacy application
  allowed it; no seeded invoice uses it, so M2b registers one cost account
  per invoice.
- **The mixed VAT amount** of the legacy invoice, beside the single VAT
  rate M2b computes from.
- **The `quadroAc` flag** of the legacy invoice, which M2b does not keep.
- **Opening invoices.** A supplier's unpaid invoices carried into a new
  period with the opening entry, so their payments can be registered there.
  M2b leaves the suppliers account out of the opening list for that reason.
- **A supplier's tax treatment as stored defaults**
  (`masterDataTaxTreatment`). Pozzetto's suppliers have none, and the
  prefill from the supplier's last invoice covers the need today.
- **Carrying a period's closing balances into the next one's opening**, so
  the opening entry is written for the person instead of typed.
- **Regenerate an edited invoice's description when its supplier changes**
  (an unpaid invoice): the description, marked edited, still names the old
  supplier; regenerate it when it still equals the generated text.
