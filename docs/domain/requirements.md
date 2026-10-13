# Legacy Requirements & Feature Catalogue

> **Provenance.** This catalogue is extracted from `old/prototype.pdf` — the original
> analytical specification *"Struttura analitica del programma"* written by Nasantsogt
> Baasanjav (2011-09-02, v1.1) for **Jtime S.r.l.**'s *"Condominium Flex Accounting System"*.
> The legacy product was a PHP **CodeIgniter** backend with an **Adobe Flex** front end
> (hence "Flex"); its database is the dump in `old/db/it-jtime-condominium.all.sql`.
>
> **Source of truth.** The original PDF describes *intent*. Where intent and reality differ,
> the **legacy database schema is the source of truth** for what the legacy system actually
> modelled, and the **current React prototype** (`apps/web/`) is the source of truth for what
> is implemented *today*. Each requirement below is cross-checked against both.
>
> See also: [`database-schema.md`](./database-schema.md) (the schema) and
> [`accounting-and-distribution.md`](./accounting-and-distribution.md) (how the accounting and
> riparto actually compute).

## How to read this

The author marked uncertainty in the original doc two ways, preserved here:
- *Italic* features were *"da prendere con le pinze"* (take with a pinch of salt) — hard,
  deferred, or low-priority. Flagged below as **🔮 aspirational**.
- `COMPLETARE!!!` / `Verificare!!!` notes marked unfinished thinking — captured in
  [§ Open questions](#open-questions--unfinished-threads).

Status columns:

| Column | Meaning |
|---|---|
| **DB** | ✅ modelled in the legacy schema · 🟡 partially · — not modelled |
| **App** | ✅ in the current React prototype · 🟡 partial/mock · — not yet built |

The prototype deliberately implements a **read-mostly subset** centred on the accounting core
(the prototype, archived outside the repository in `old/prototype-web`); breadth items (resident portal, fiscal
filings, dunning, documents) live in the legacy schema but not in the prototype.

---

## 1. Anagrafiche — unified party registry

A single registry for **every** party — owners (_condòmini_), suppliers, professionals,
companies, even the managing agent — with no duplicates, so one party can simultaneously be,
say, an owner of one unit and a supplier of another building.

| Requirement | DB | App | Notes / backing tables |
|---|---|---|---|
| Unified registry (no duplicate parties) | ✅ | ✅ | `masterData` (+`person`/`company` 1:1 extensions) |
| Homonym handling via unique `code` | ✅ | ✅ | `masterData.code` |
| Type-ahead party selection + create-in-place | ✅ | 🟡 | registry exists; prototype has search/select, no inline-create everywhere |
| Multiple typed **contacts** per party (phone/email/PEC/skype…), reorderable, custom labels | ✅ | — | `masterDataContact` (+`I18n`) |
| Address autocomplete from comuni (IT only) | ✅ | — | geo tables: `city`(+`I18n`), `cityPostCode`, `postCode`, `district`, `minorCivilDivision`, `state`, `country` |
| **Categorisation** of parties (idraulici, avvocati… and auto-category "Condòmini") | ✅ | ✅ | `masterDataCategory` (+`I18n`); prototype shows category filter/badges |
| Rich **search** (name, CF/P.IVA, persons vs companies, status, account type) | ✅ | ✅ | prototype: search + kind + stato + categoria filters |
| **Cross-relations** between parties (employees, CEO, external collaborator) | ✅ | — | `masterDataCrossRelation` (+`I18n`) |
| Decoupled online **accounts** per party, with access profiles | ✅ | — | `accessAccount`(+`Grant`/`ActivationRequest`), `grant`(+`I18n`), `passwordResetRequest` |
| **Historisation** — recover prior name/address/contact at any past date; closed periods keep period-valid names | ✅ | — | `masterDataVariation`, `personVariation`, `companyVariation` |
| **Fiscal treatment** per supplier: codice tributo & aliquota R/A, default IVA, Quadro-AC inclusion, professional cassa-previdenza / INPS | ✅ | — | `masterDataTaxTreatment`, `tribute`, `qualification`, `withholdingTax`(+`2LA`) |

---

## 2. Condomìni & gestioni (buildings & accounting periods)

The home screen lists **all buildings/periods** with live financial totals so an agent
monitors the whole portfolio at a glance.

| Requirement | DB | App | Notes / backing tables |
|---|---|---|---|
| Portfolio dashboard with per-period totals: liquidità, fondi, preventivo, consuntivo, saldo prec., totale dovuto, versato, scaduto, attivo/passivo, crediti/debiti vs condòmini/fornitori/Erario | ✅ | 🟡 | `accountingPeriod`; prototype "Dati" shows per-period summary money columns (subset of these) |
| Roll-up across open periods (ordinario + straordinari + ausiliari) and across all buildings (total insolvenze) | ✅ | 🟡 | prototype rolls up units/tables per period; no studio-wide "scaduto" total |
| Create next ordinary period (copy units, tables, chart of accounts) | ✅ | — | `accountingPeriod` (type) |
| Lock a closed period against edits | ✅ | 🟡 | `accountingPeriod.status` (closed); prototype marks `closed` but is read-mostly |
| Parallel **straordinari** & **ausiliari** periods (ausiliari can chain, straordinari cannot) | ✅ | 🟡 | `accountingPeriod.type` ∈ regular/extra/auxiliary — prototype renders all three with correct labels |
| **Arbitrary unlimited hierarchy** of building structure (palazzine, scale, piani…) | ✅ | 🟡 | `unitGroup.parentUnitGroupId` (self-tree); prototype shows the unit tree but not deep group nesting |
| Restrict a cost's riparto to a sub-group (reuse a table, zero out coefficients outside the group) | ✅ | — | `expenseLedgerAccount.restrictionUnitGroupId` |
| **Super-condomìni** (sub-buildings as unit groups, *separate* accounting) | ✅ | 🟡 | `condominium.type='super'`, `parentCondominiumId`; prototype shows Sole as a super node |
| 3 ownership **scenarios**: standard / usufrutto+nuda proprietà / leasing; + subaffitto | ✅ | 🟡 | `unitOwnershipScenario`(+`I18n`), `unitResidentRole`(+`I18n`), `unitResidentPriority` |
| **Subentri & multi-ownership/conduzione** with %s that vary over time, via per-unit **periods** | ✅ | 🟡 | `unitPeriod` + `unitResident.percentage`; prototype reads them, limited UI |
| Vacant ("sfitto") unit periods + competence-date-based riparto reduction | ✅ | — | `unitPeriod` (period restriction dates) |
| Per-unit residents card (grouped by role, by period, with day-ratio × % = effective coefficient) | ✅ | 🟡 | prototype Unità tree shows residents + role + %, not the day-ratio |
| Units list: hierarchical roll-up, optional re-group **by party**, auto-expand multi-resident/multi-period, optional codes/names | ✅ | 🟡 | prototype Unità tree (group→unit→resident); no "regroup by party" toggle |
| Per-party total across units (regroup by condòmino) | ✅ | — | derivable; not a prototype toggle |
| Overdue-payment red-flag (`!`) on residents with arrears | ✅ | — | derivable from installments; not in prototype |
| Print access letters (username/password) per resident | ✅ | — | `unitResidentAccount` |
| **Technical specs** — arbitrary label/value pairs, templated | ✅ | — | `condominiumAttribute` (+`I18n`) |
| *Insurance **polizze** (expiry tracking, calendar alerts, attachments)* 🔮 | — | — | **no table** — aspirational |
| *Building **photos*** 🔮 | — | — | **no table** — aspirational (author: "bello ma…") |

---

## 3. Contabilità — double-entry general ledger

The differentiator vs. simple-bookkeeping competitors: a real double-entry GL that is always
balanced. (See [`accounting-and-distribution.md` §2](./accounting-and-distribution.md#2-double-entry-accounting)
for the mechanics.)

| Requirement | DB | App | Notes / backing tables |
|---|---|---|---|
| Double-entry GL, always in quadratura; open-items (vs fornitori / condòmini / Erario) | ✅ | ✅ | `ledgerTransaction` + `ledgerEntry` (signed amount, sums to 0) |
| Chart of accounts: 3 mastri (Patrimoniali→Attività/Passività, Costi, Ricavi), arbitrary depth | ✅ | ✅ | `ledgerAccount` tree (`parentLedgerAccountId`, `kind`, `type`) |
| **Partitari** accounts (every line tied to a party): supplier & condòmino sub-types | ✅ | 🟡 | `ledgerAccount.type` ∈ control/`controlUnitResident`; `ledgerEntry.masterDataId`/`unitResidentId`; prototype shows balances, limited partitario drill |
| Hybrid active/passive partitario accounts (sub-accounts flip side by saldo sign) | ✅ | 🟡 | crediti/debiti vs condòmini account |
| Default counter-account per account (speed up free entries) | ✅ | — | `ledgerAccount.defaultCounterAccountId`/`…MasterDataId` |
| **Special accounts**: liquidità (grouping), Cassa Contanti, Conto Corrente Predefinito, Debiti vs Fornitori, per-tributo R/A accounts, Crediti/Debiti vs Condòmini, Arrotondamenti, Spese Personali (+ contropartita), Ricavi da Riparto Preventivo, Ricavi da Conguaglio… | ✅ | 🟡 | functional-account FKs on `accountingPeriod` (liquid/payable/withholding/credit modelled; prototype maps these four) |
| Hard/soft **balance limits** per account | ✅ | — | `ledgerAccount.balanceHard/Soft Lower/UpperLimit` |
| Chart-of-accounts **templates**, pre-loaded defaults | 🟡 | — | per-period accounts exist; no separate template entity surfaced |
| Chart-of-accounts screen: Dare/Avere/Saldo roll-up; Stato Patrimoniale & Conto Economico read directly off the tree; collapse to a synthetic view; verify Attivo=Passivo and Costi=Ricavi and root=0 | ✅ | ✅ | prototype "Conti" tree with rolled-up dare/avere/saldo + preventivo |
| **Mastrino** per account (and aggregated for grouping accounts); double-click → transaction | ✅ | 🟡 | derivable from entries; prototype has partial mastrino |
| **Libro Giornale** — all transactions, expandable to balanced lines, special-transaction icons | ✅ | ✅ | prototype "Giornale" |
| **Wizards** for common entries: opening balances, invoice registration, invoice payment, cash/bank direct payment, preventivo riparto posting, R/A payment to Erario, takings (incassi, partial/grouped, barcode/QR/bollettino), conguaglio, refund, interest accrual, agent advance, insurance refund, credit notes, giroconto, fund accrual/release | ✅ | 🟡 | `ledgerInvoice`, `withholdingTax`, transaction types; prototype ports expose `addTransaction/registerInvoice/recordTaking/createInstallments/payWithholding/openBalances` (mock) |
| Free balanced entries (grid Dare/Avere, party required on partitari, real-time balance check) | ✅ | 🟡 | prototype `addTransaction` |

---

## 4. Riparto — expense distribution

Cost accounts are linked to **distribution tables** (millesimi); each link further splits by
**attribution criteria** between owner/tenant roles. This is the heart of the domain — the full
worked example is in
[`accounting-and-distribution.md` §4.3](./accounting-and-distribution.md#43-worked-example--from-three-expenses-to-three-peoples-bills).

| Requirement | DB | App | Notes / backing tables |
|---|---|---|---|
| Cost sub-accounts carry preventivo amounts; riparto preventivo & consuntivo | ✅ | ✅ | `expenseLedgerAccount.estimate`; prototype estimate + current matrices |
| Link a cost account to **one or more** tables in proportions (e.g. 60%/40%) | ✅ | ✅ | `expenseLA2Table` (percentage) |
| **Attribution criteria** per linked table — split each table's share between roles (e.g. `Proprietà (100% Pr)`, `Scale (100% Co)`, `60% Proprietà(100%Pr)+40% Scale(50%Pr+50%Co)`); fallback to owner when no tenant | ✅ | ✅ | `expenseLA2Role` (priority + percentage); faithfully reproduced by the riparto engine |
| **Per-unit attribution exceptions** (override the building-wide role split for one unit) | ✅ | — | `expenseLAUnitException` (+`Item`) — *empty in the dump* |
| Separate **estimate** vs **consuntivo** tables on a cost (esp. meter-linked) | ✅ | ✅ | `expenseLA2Table.type` ∈ estimate/currentBalance |
| Restrict riparto to a unit sub-group (zero outside coefficients) | ✅ | — | `expenseLedgerAccount.restrictionUnitGroupId` |
| Inherited attribution (most-specific account wins down the tree) | ✅ | 🟡 | account tree; engine distributes per linked account |
| **Tables & meters** screen: coefficient grid (editable, hierarchical roll-up), riparto grid (preventivo/consuntivo × by-unit/by-party × by-cost-account/by-table), print/export | ✅ | 🟡 | `distributionTable`, `distributionTableItem`; prototype "Tabelle" shows tables + matrices, fewer view toggles |
| **Consumption meters** (gas/water readings per unit+date, estimation when missing) | ✅ | — | `consumptionMeter` — *present but 0 rows in the dump* |
| *Formula-based ("su parametri") riparto criteria + formula interpreter* 🔮 | — | — | author: "non presente in nessun altro software, ci tiene Gianmaria" — aspirational |

---

## 5. Pianificazione rateale — installments & collection

Distributes preventivo + carry-over (rimanenze) over dated installments, prints payment slips,
and chases arrears.

| Requirement | DB | App | Notes / backing tables |
|---|---|---|---|
| Installment plan (preventivo + carry-over) | ✅ | ✅ | `installment`, `installmentItem`; prototype "Rate" |
| **Rate di acconto** (forfait, before preventivo approval) | ✅ | 🟡 | `installment.type` |
| **Preventivo wizard**: N installments + due dates, auto-split %, where carry-over lands, round-to-euro, manual override, lock-after-send, subtract acconti | ✅ | 🟡 | `accountingPeriodInstallmentDefaultSettings`, `installment.locked`/`roundedUpToInteger`; prototype `createInstallments` (mock) |
| **Rate di conguaglio** (incl. negative → zero-out or refund) | ✅ | — | `installmentGroup`(+`I18n`) |
| **Bollettini** (payment slips): a mano, **MAV**, postali (pre-printed), freccia; bulk print; merge a party's units into one slip | ✅ | — | `installmentPaymentSlip` (+`Item`), `bankTransferPO`, `bankAccount` |
| Automate takings via bollettino code / barcode / QR; partial & grouped payments | 🟡 | 🟡 | `installmentItem.status`; prototype `recordTaking` (mock) |
| **Morosità**: spot overdue from the grid; per-resident **solleciti** history (1°/2°/3°/legal), bulk generation | ✅ | — | derivable; no dedicated dunning table beyond installment status |
| Auto-charge postal/admin fees per sollecito (Danea-style) | — | — | author defers to manual entries |
| **Interest** on late payment (from ~day 10), posted as utile d'esercizio | 🟡 | — | via ledger; complex calc, deferred |

---

## 6. Adempimenti fiscali — tax filings

| Requirement | DB | App | Notes / backing tables |
|---|---|---|---|
| **F24** (R/A payment slips) + ravvedimento operoso | ✅ | 🟡 | `f24`, `ledgerInvoice2F24`, `withholdingTax`; prototype lists F24 rows (importo shown as 0 — no clean per-row source) |
| **770S** | 🟡 | — | data present (`withholdingTax`, `masterDataTaxTreatment`); report not built |
| **Quadro AC** (Modello Unico) | 🟡 | — | `masterDataTaxTreatment` flag; report not built |
| Certificazioni sostituto d'imposta / compensi a R/A | 🟡 | — | report over `withholdingTax` |
| Certificazioni detrazioni 36% / 55% | 🟡 | — | `taxRelief`; report not built |

---

## 7. Impianti & parti comuni (plant & common parts)

The author left this section explicitly unfinished: **`COMPLETARE!!! Vedi Story ID 28`**.
**DB —, App —.** No backing tables; not modelled. (Document-management hooks for technical
drawings/manuals/service contracts were envisioned — see §9.)

---

## 8. Scadenziario — calendar / deadlines

A month/week calendar (Google-Calendar-like) aggregating every dated event.

| Requirement | DB | App | Notes / backing tables |
|---|---|---|---|
| Calendar of installment & invoice due dates, policy expiries, assembly convocations, maintenance terms, planned interventions, legal deadlines, F24/770/Modello-Unico terms, period closures, manual events | ✅ | 🟡 | `calendarEvent`, `calendarLayer`, `condominiumCalendarEvent`; prototype renders events (one synthesized layer — dump has 0 `calendarLayer` rows) |
| Filter by building; filter by **event category/layer** | 🟡 | 🟡 | `calendarLayer` exists; prototype is studio-wide, month-filtered |

---

## 9. Gestione documentale — document attachments

Attach files wherever it helps: policy scans, invoice scans, plant drawings/manuals/service
contracts, assembly minutes (verbali), regolamento, planimetrie; a "public" flag controls
frontend visibility.

**DB —, App —.** No file/attachment table in the dump; not modelled in either the legacy
schema (as captured here) or the prototype. **🔮 aspirational.**

---

## 10. Partite aperte — global open items

A **studio-wide** section pooling *all* unpaid installments, unpaid supplier invoices, unpaid
R/A and interest/penalties across **every** building & period — so the agent doesn't hop
building-to-building.

**DB 🟡** (derivable from `installmentItem` + `ledgerInvoice` + `withholdingTax` statuses),
**App —** (no global cross-portfolio view in the prototype).

---

## 11. Attività (activities)

Explicitly unfinished in the original: **`COMPLETARE!!!`**. **DB —, App —.** Not modelled.

---

## 12. Usabilità — UX principles

Designed for high-volume, error-free data entry. **DB n/a; App 🟡** (the prototype follows the
spirit — consistent layouts, dense single-screen views, search fields — but does not implement
the full keyboard/data-entry automation).

- Date auto-completion (`99`→`09/09/2011`, `311211`→`31/12/2011`).
- Keyboard-first entry: Tab/Shift-Tab, Enter=next/finish wizard, Esc=cancel, Ctrl+←/→ wizard
  steps, Ctrl+N new, Ctrl+M/Enter edit, Canc delete (with confirm), Ctrl/Shift-click multi-select.
- Real-time validation (dates, email, phone, CAP, required fields, code formats).
- Cross-section consistency; persistent search fields; fixed positions for new/edit/delete/print/export.
- Single-screen density; per-section **legend** button; right-click **contextual help** linked
  to online guide; resizable panels.

---

## 13. Frontend — resident portal

The access point where agent and residents exchange information. A party related (as owner,
tenant, sub-tenant, bare-owner, usufructuary, leasing co./financial-tenant) to multiple units —
possibly across buildings — sees aggregated installments + calendar but separate boards.

| Requirement | DB | App | Notes / backing tables |
|---|---|---|---|
| Resident login / accounts | ✅ | — | `unitResidentAccount`, `accessAccount`(+`Grant`), `grant` |
| Avvisi & scadenze (rate due, solleciti, convocazioni, period closure, generic notices) | 🟡 | — | calendar + installment data; no portal UI |
| Payments view: per-unit installments with paid/overdue/imminent flags; bank/postal coordinates; print bollettini; *online card payment* 🔮 | 🟡 | — | `installment*`, `bankAccount` |
| Accounting view: preventivo/consuntivo balances, millesimi, riparto, prospetto rate, individual balances, access to prior/parallel periods | ✅ | — | full ledger/riparto data exists; no portal UI |
| General info: related buildings, units, suppliers (by category), the managing agent | ✅ | — | registry + `propertyManager`(+`Association`) |
| **Segnalazioni / tickets** (threaded, status open/in-progress/closed; intervention auto-notices; public vs private) | ✅ | — | `ticket`, `ticketMessage`, `ticketTopic` |
| *Bacheca condominiale (notice board)* 🔮 | — | — | no table |
| *Sondaggi (pre-assembly polls)* 🔮 | — | — | no table |
| *Assemblee (agenda, online voting)* 🔮 | — | — | no table |
| Resident self-service personal data (contacts, login/password, bank coords) | ✅ | — | `masterDataContact`, `accessAccount`, `bankAccount` |
| Embed frontend from the agent's website | — | — | aspirational |

---

## 14. Cross-cutting (multilingua, multiutenza, no-install)

| Requirement | DB | App | Notes |
|---|---|---|---|
| **Multilanguage** UI (IT/EN) incl. number/currency/date conventions | ✅ | 🟡 | pervasive `*I18n` side-tables; current app is IT, react-i18n-ready |
| Optional **data** translation (e.g. account names): translation-first, fallback to original | ✅ | — | `ledgerAccountI18n`, `installmentI18n`, etc. |
| **Multi-user** networked app; live updates; sophisticated **conflict resolution** (optimistic concurrency) | 🟡 | — | `studio`, `codeIgniterSession`; not in the offline prototype |
| **No install** — open a URL and go | n/a | ✅ | the web app is exactly this |

---

## Backing-tables index

Quick map from feature area → legacy tables (the dump has **95** tables; peripheral
auth/geo/banking lookups omitted from the per-section tables above):

- **Parties / anagrafiche:** `masterData`, `person`, `company`, `*Variation`, `masterDataCategory(+I18n)`, `masterDataContact(+I18n)`, `masterDataCrossRelation(+I18n)`, `masterDataTaxTreatment`, `qualification`, `tribute`, `withholdingTax(+2LA)`, `taxRelief`
- **Buildings / periods / units:** `condominium`, `condominiumAttribute(+I18n)`, `accountingPeriod`, `accountingPeriodInstallmentDefaultSettings`, `unitGroup`, `unit`, `unitType(+I18n)`, `unitOwnershipScenario(+I18n)`, `unitPeriod`, `unitResident`, `unitResidentPriority`, `unitResidentRole(+I18n)`, `condominiumSupplier`, `propertyManager`, `propertyManagersAssociation(+Code)`, `studio`, `license`
- **Ledger:** `ledgerAccount(+I18n)`, `ledgerTransaction`, `ledgerEntry`, `ledgerEntry2URDistribution`, `ledgerInvoice(+2F24)`
- **Riparto:** `expenseLedgerAccount`, `expenseLA2Table`, `expenseLA2Role`, `expenseLAUnitException(+Item)`, `distributionTable`, `distributionTableItem`, `consumptionMeter`
- **Installments / collection:** `installment(+I18n)`, `installmentGroup(+I18n)`, `installmentItem`, `installmentPaymentSlip(+Item)`, `bankTransferPO`, `bank`, `bankBranch`, `bankAccount`
- **Fiscal:** `f24`, `withholdingTax(+2LA)`, `tribute`, `taxRelief`, `masterDataTaxTreatment`
- **Calendar:** `calendarEvent`, `calendarLayer`, `condominiumCalendarEvent`
- **Frontend / access / tickets:** `accessAccount(+Grant/+ActivationRequest)`, `grant(+I18n)`, `unitResidentAccount`, `passwordResetRequest`, `ticket`, `ticketMessage`, `ticketTopic`, `codeIgniterSession`
- **Geography:** `city(+I18n)`, `cityPostCode`, `postCode`, `district(+I18n)`, `minorCivilDivision(+I18n)`, `state(+I18n)`, `country(+I18n)`, `locale(+I18n)`
- **No backing table (aspirational):** insurance policies, building photos, document attachments, notice board (bacheca), polls (sondaggi), assemblies (assemblee), plant/common-parts ("impianti"), activities ("attività")

---

## Open questions & unfinished threads

Verbatim uncertainties the author flagged (still worth resolving for any modern build):

1. **INPS aliquota for non-albo professionals** — can it be ignored, or is it needed to
   auto-fill the 770? *("Occorre chiarire…")*
2. **Utile/perdita d'esercizio should be 0** — the preventivo↔consuntivo gap creates a
   temporary utile/perdita closed by the **conguaglio a consuntivo**; the author repeatedly
   noted *"Verificare il ragionamento!!!"* around the Ricavi-da-Riparto-Preventivo and
   Ricavi-da-Conguaglio counter-accounts.
3. **Arrotondamenti account** — should the rounding account be partitario or not? *("Verificare")*
4. **Late-payment interest** raises Ricavi > Costi — is that acceptable? *("Verificare!!!")*
5. **§7 Impianti & parti comuni** — `COMPLETARE!!! Vedi Story ID 28`.
6. **§11 Attività** — `COMPLETARE!!!`.
7. **Consumption-meter riparto** is inherently approximate (readings not same-day, billing
   periods misaligned, subentri) — the author accepts "qualcuno pagherà di più o di meno".
8. **Cost-account UX** was "copiata quasi pari a pari da Danea" and the author wanted it
   **simplified** — a standing design debt.

> How today's prototype answers #2 in practice: it never *shows* an unbalanced period — the
> reconciliation gate ships accounting only when the trial balance nets to zero
> ([`accounting-and-distribution.md` §3](./accounting-and-distribution.md#3-reconciliation)),
> sidestepping the utile/perdita question for display.
