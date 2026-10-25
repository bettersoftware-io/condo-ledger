# Amounts in the session's locale — design

Date: 2026-10-25. Status: built.

It overrides, for amounts only, the design README's "Format: en-US style
`1,234.56`" (`docs/design/web/v1/README.md`, "Money cell") and the en-US
reading of `parseAmount` that M2a pinned
(`2026-10-14-m2a-journal-design.md`). Dates, percentages and every other
number stay as they were.

## The decision

The user's words: "The amounts should follow whatever locale is set in the
user setting." The setting is the session's `preferences.language`, changed
from the top bar's language picker. Each language has one locale:

| Language | Locale | Shown | Typed (all read) | Written into a form |
|---|---|---|---|---|
| en | en-US | `1,234.56` | `1,234.56`, `1234.56`, `12` | `1234.56` |
| it | it-IT | `1.234,56` | `1.234,56`, `1234,56`, `12` | `1234,56` |
| fr | fr-FR | `1 234,56` (narrow no-break spaces) | groups by a space, a no-break space or a narrow no-break space, or none | `1234,56` |
| de | de-DE | `1.234,56` | as it-IT | `1234,56` |
| es | es-ES | `1.234,56` | as it-IT | `1234,56` |

- **Shown** amounts are `Intl.NumberFormat(locale)` with exactly two
  decimals and `useGrouping: "always"`. "Always" matters for es-ES, and for
  it-IT under current ICU data too: both leave a four-digit number
  ungrouped by default (`1234,56`) and group from five digits on
  (`12.345,67`). Amounts sit in right-aligned columns, so every group is
  marked and the column reads alike. Money's sign and zero rules do not
  change.
- **Typed** amounts must use the locale's decimal separator. Group
  separators may be left out, and where they are written they must stand
  every three digits. In it-IT `1,234.56` is not an amount. A leading minus
  is allowed where it was before; whether a sign is accepted is still the
  domain's decision.
- **Written** amounts (a wizard's prefill, an edited entry's amounts) use
  the locale's decimal separator and no groups, so the person can edit them
  without deleting separators.
- The setting is read **live**. A change of language redraws every shown
  amount at once. An open form keeps the text the person typed and reads it
  in the language of the moment it is judged: a wizard judges its form again
  as soon as the language changes, with no edit needed. So `1,234.56` typed
  in English becomes "not an amount" when the person switches to Italian.

## Where it lives

- **Core (`client-core/src/amounts.ts`).** `AmountLocale` and the one
  mapping from language to locale, `amountLocaleOf`. `parseAmount(text,
  locale)` and `amountText(amount, locale)` stay pure and are driven by a
  fixed table of separators per locale. `AmountTexts` is what a wizard is
  given: `parse` and `text` in the locale at the moment they are called, and
  `changed$`, which emits each new locale.
- **Session presenter.** `amountLocale$`, derived from `preferences$`.
- **Composition.** `createApp` keeps one subscription to `amountLocale$` for
  the application's life and builds `amountTextsIn(session.amountLocale$)`
  once. Every wizard that reads amounts takes it as its first argument.
  `createWizardMachine` takes an optional `rejudge$` (the wizards pass
  `texts.changed$`). Each emission derives the form as it stands again.
- **View model.** `useAmountLocale()`, one hook over `amountLocale$`.
- **UI.** `AmountLocaleProvider` (in the shell, `AppRoot`) reads the hook
  once and hands the locale down through `AmountLocaleContext`. Money cells
  and the other leaf components read it with `useLocale()`, so a leaf adds
  no subscription of its own and stays compiled. `formatCents(amount,
  locale)` keeps one `Intl.NumberFormat` per locale. The budget editor and
  the schedule's cell editor pass the same locale to `parseAmount`. A
  component drawn without the provider (a unit test, a component golden)
  shows `DEFAULT_AMOUNT_LOCALE`, the default language's locale (en-US).

## What it does not change

- Dates (`dd/mm/yyyy`), the invoice wizard's rates and the budget installments
  wizard's percentages (`33.33`) are read and written as before, whatever the
  language. A rate typed `21,5` in Italian is still not a rate. Whether
  percentages should follow the amounts is open.
- The default language is en, so no golden changes.
