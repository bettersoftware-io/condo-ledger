# Prototype Completion — Plan 4: Anagrafiche + Fixture Enrichment + Parity Pass

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `AnagraficheStub` with the real Anagrafiche module (filter sidebar, paged grid, detail tabs, person/company CRUD), enrich fixtures with a dump-accurate anagrafiche registry, reroute the Fornitori picker through the port, and close the spec with the side-by-side screenshot-parity pass.

**Architecture:** Same ports-and-adapters pattern as Plans 1–3: `@cl/application` gains the `Anagrafica` contract; `MockStore` gains a `BehaviorSubject`-backed collection plus a cross-reference derivation (`anagraficaLinks`); `createAppRuntime` gains an **anagrafiche slice** whose search/tipo/categoria filters compose as one derived stream (spec §5.2); the module is presentational components wired through `useAppRuntime()` only. The registry is **studio-wide** (like the calendar) — NOT gated on `selection$` (legacy `masterData` has no condominium FK).

**Tech Stack:** React 18 + TS strict (`noUncheckedIndexedAccess`), react-rxjs `bind()` per factory call, RTL + vitest, Radix Tabs/Dialog, CSS modules with tokens from `apps/web/src/styles/tokens.css`.

**Branch:** `feat/prototype-complete` (continue from `079f67c`; do NOT branch off).

---

## Context for implementers (read once, applies to all tasks)

- **Spec:** `docs/superpowers/specs/2026-06-11-prototype-completion-design.md` §5.2 (Anagrafiche), §5.3 (runtime slice), §6 (required test: "anagrafiche search + category filter"), §7.4 (fixture-enrichment + screenshot pass). Reference screenshot: `old/screenshots/presentazione Vittorio/50 - anagrafiche - tutto.png`.
- **Legacy sources (already mined, transcribed into this plan):** Flex `old/flex/src/it/jtime/components/view/masterData/*.mxml` + Italian labels from `old/flex/locale/components/it_IT/Components.properties`; dump tables `masterData`, `masterDataCategory`, `person`, `company` in `old/db/it-jtime-condominium.all.sql`. You do NOT need to re-read them; every label and fixture value below is final.
- **Conventions (established Plans 1–3, do not deviate):**
  - Components NEVER import `MockStore`/fixtures — everything via `useAppRuntime()` and `rt.commands.*`. (Single sanctioned exception being REMOVED by Task 10: `DatiDialogs.tsx` imports `supplierCandidates`.)
  - Every `bind()` call gets a default mirroring the subject seed; no module-level singletons (everything inside `createAppRuntime`).
  - Dialogs: single-step `WizardDialog` with `submitLabel="Salva"`; `onSubmit` returns `false` to veto-close (wrap command in try/catch → `toast(message)` → `return false`). Seed dialog state ONCE per open-transition via a `wasOpen` ref (see `apps/web/src/modules/calendario/EventDialog.tsx`) — prop identity changes while open must not clobber typing.
  - Deterministic ids: slug + `-2`/`-3` suffix loop against the FULL collection (see `uniqueEventId` in `EventDialog.tsx`).
  - CSS modules use REAL tokens only: `--border-strong`, `--surface-panel-header`, `--surface-row-hover`, `--surface-row-selected`, `--surface-panel`, `--surface-app`, `--fs-sm`, `--fs-xs`, `--fw-bold`, `--sp-1..4`, `--radius-sm`, `--text-secondary`, `--text-muted`, `--lh-normal`. Never invent token names; check `apps/web/src/styles/tokens.css` if unsure.
  - Tests: `pnpm --filter @cl/web exec vitest run <path>` for one file, `pnpm --filter @cl/web test` for the suite, `pnpm -r typecheck` for types. vitest serves CSS-module class names un-scoped. Use `fireEvent.change` for `<input type="date">`.
  - Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **Type-driven sequencing:** Task 1 extends the port contracts. `pnpm -r typecheck` goes RED for `@cl/web` (MockStore and createAppRuntime no longer satisfy the widened interfaces) and returns GREEN after Task 4. The vitest suite is unaffected in between (vitest does not typecheck) and must stay green after every task.

**Documented deviation from spec §5.2:** the spec lists a "condominio" filter in the sidebar, but the legacy `MasterDataFilter.mxml` has no such field — its actual filters are Parola Chiave, Persone fisiche/Società and **Status Anagrafiche** (plus AccessAccountRole, out of scope: access accounts are not modeled). Legacy fidelity wins: the sidebar implements keyword + tipo + **stato** + categorie. Cross-condominium visibility is served read-only by the "Anagrafiche Condomini" detail tab instead.

## File structure

```
packages/application/src/types.ts            (modify: Anagrafica types)
packages/application/src/ports.ts            (modify: CRUD + streams + runtime hooks)
apps/web/src/mock/fixtures.ts                (modify: categories registry, anagrafiche, supplier categoria alignment; Task 10 removes supplierCandidates)
apps/web/src/mock/fixtures.test.ts           (modify: anagrafiche alignment describe-block)
apps/web/src/mock/MockStore.ts               (modify: anagrafiche$ + CRUD + links derivation)
apps/web/src/mock/MockStore.test.ts          (modify: anagrafiche describe-block)
apps/web/src/runtime/createAppRuntime.ts     (modify: anagrafiche slice)
apps/web/src/runtime/runtime.test.tsx        (modify: anagrafiche probe tests)
apps/web/src/modules/anagrafiche/labels.ts                   (create)
apps/web/src/modules/anagrafiche/FilterPane.tsx              (create) + FilterPane.module.css + test
apps/web/src/modules/anagrafiche/AnagraficheGrid.tsx         (create) + AnagraficheGrid.module.css + test
apps/web/src/modules/anagrafiche/AnagraficaDetails.tsx       (create) + AnagraficaDetails.module.css + test
apps/web/src/modules/anagrafiche/AnagraficaLinks.tsx         (create; shares AnagraficaDetails.module.css) + test
apps/web/src/modules/anagrafiche/AnagraficaDialog.tsx        (create) + test
apps/web/src/modules/anagrafiche/AnagraficheModule.tsx       (create) + AnagraficheModule.module.css + test
apps/web/src/components/common/Icon.tsx      (modify: add `user` glyph)
apps/web/src/components/layout/AppShell.tsx  (modify: mount module)
apps/web/src/modules/AnagraficheStub.tsx     (DELETE, Task 9)
apps/web/src/modules/Stub.module.css         (DELETE, Task 9 — last consumer gone)
apps/web/src/sections/dati/DatiDialogs.tsx   (modify, Task 10: SupplierDialog via port)
apps/web/src/sections/dati/DatiCondominioSection.test.tsx (modify, Task 10)
apps/web/README.md                           (modify, Task 11: Anagrafiche + parity table)
```

---

### Task 1: Port contracts — Anagrafica types, commands, streams, runtime hooks

**Files:**
- Modify: `packages/application/src/types.ts` (append at end)
- Modify: `packages/application/src/ports.ts`

No new tests (pure contracts). After this task `pnpm --filter @cl/application typecheck` is green; `@cl/web` typecheck is deliberately RED until Task 4.

- [ ] **Step 1: Append the Anagrafiche types to `types.ts`**

Append after the Calendario block (end of file):

```ts
/** ---- Anagrafiche (Plan 4) ---- */
export type AnagraficaKind = "person" | "company";    // legacy person / company tables
export type AnagraficaStatus = "active" | "archived"; // legacy masterData.status enum
export interface Anagrafica {
  id: Id;
  kind: AnagraficaKind;
  /** display name: "Cognome Nome" for persons, ragione sociale for companies */
  nominativo: string;
  categoria: string;        // masterDataCategory name; registry in anagraficaCategories()
  stato: AnagraficaStatus;
  codice?: string;          // legacy masterData.code, e.g. "FCLEAN"
  indirizzo?: string;       // single-line reference address ("Indirizzo di riferimento")
  codiceFiscale?: string;
  partitaIva?: string;
  /* person-only fields (legacy person table) */
  nome?: string;
  cognome?: string;
  sesso?: "m" | "f";
  dataNascita?: string;     // ISO yyyy-mm-dd
  luogoNascita?: string;
  professione?: string;
  /* bank coordinates (legacy bankAccount link), shown for companies */
  banca?: string;           // legacy "Banca / Filiale"
  iban?: string;
  note?: string;
}
/** Cross-reference row for the "Anagrafiche Condomini" tab (read-only, derived). */
export interface AnagraficaLink {
  condominio: string;       // condominium display name (no address suffix)
  esercizio: string;        // accounting-period name, e.g. "2011 (Ordinario)"
  ruolo: "Fornitore" | "Condòmino";
  dettaglio: string;        // supplier categoria, or the matched unit-tree row label
}
export type AnagraficaKindFilter = "tutte" | "person" | "company";
export type AnagraficaStatusFilter = "tutte" | AnagraficaStatus;
```

- [ ] **Step 2: Extend `ports.ts`**

Add to the type-import list in `ports.ts`: `Anagrafica, AnagraficaLink, AnagraficaKindFilter, AnagraficaStatusFilter`.

Append to `CrudCommands` (after `removeCalendarEvent`):

```ts
  addAnagrafica(a: Anagrafica): void;
  editAnagrafica(id: Id, patch: Partial<Anagrafica>): void;
  removeAnagrafica(id: Id): void;
```

Append to `MockDataSource` (after `calendarEvents()`):

```ts
  /** studio-wide registry (legacy masterData); filtering happens in the runtime */
  anagrafiche(): Observable<Anagrafica[]>;
  /** static category registry (legacy masterDataCategory); no CRUD in the prototype */
  anagraficaCategories(): Observable<string[]>;
  /** where this anagrafica appears in the condomini data (suppliers + unit tree) */
  anagraficaLinks(anagraficaId: Id): Observable<AnagraficaLink[]>;
```

Append to `AppRuntime` (after `useAllCalendarEvents`):

```ts
  /** ---- Anagrafiche slice (Plan 4) ---- */
  useAnagSearch(): string;
  setAnagSearch(q: string): void;
  useAnagKind(): AnagraficaKindFilter;
  setAnagKind(k: AnagraficaKindFilter): void;
  useAnagStato(): AnagraficaStatusFilter;   // legacy "Status Anagrafiche" filter
  setAnagStato(s: AnagraficaStatusFilter): void;
  useAnagCategory(): string | null;     // null = all categories
  setAnagCategory(c: string | null): void;
  useSelectedAnagrafica(): Id | null;
  selectAnagrafica(id: Id | null): void;
  /** search + tipo + categoria composed as one derived stream, sorted by nominativo */
  useAnagrafiche(): Anagrafica[];
  /** unfiltered list — id-uniqueness pool for dialogs and the Fornitori picker */
  useAllAnagrafiche(): Anagrafica[];
  useAnagraficaCategories(): string[];
  /** counts over the UNFILTERED list (sidebar badges stay stable while filtering) */
  useAnagraficaCategoryCounts(): Record<string, number>;
  /** links of the selected anagrafica ([] when none selected) */
  useAnagraficaLinks(): AnagraficaLink[];
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm --filter @cl/application typecheck` — expected PASS.
Run: `pnpm -r typecheck` — expected FAIL only in `@cl/web` (MockStore/createAppRuntime miss the new members). That is the planned red state.
Run: `pnpm --filter @cl/web test` — expected all PASS (vitest does not typecheck).

```bash
git add packages/application/src/types.ts packages/application/src/ports.ts
git commit -m "feat(application): anagrafiche port contracts — types, CRUD, streams, runtime slice"
```

---

### Task 2: Fixtures — category registry, 23 anagrafiche, supplier categoria alignment

**Files:**
- Modify: `apps/web/src/mock/fixtures.ts`
- Modify: `apps/web/src/mock/fixtures.test.ts`

Fixture-enrichment pass (spec §7.4): names, P.IVA, codes and addresses are hand-transcribed from the dump (`company`, `person`, `masterData`, `masterDataCategory` tables). Persons tied to fixture units keep the established prototype names (Alberi Dina, Mauri Dina, Picech Giorgio, Floreani Tiziano) so cross-module fixtures keep telling one story.

- [ ] **Step 1: Write the failing alignment tests**

Append to `apps/web/src/mock/fixtures.test.ts` (import `* as fx` is already there; extend the existing import if needed):

```ts
describe("anagrafiche fixtures", () => {
  test("ids unique, categorie known, kind fields consistent", () => {
    const ids = fx.anagrafiche.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of fx.anagrafiche) {
      expect(fx.anagraficaCategories).toContain(a.categoria);
      if (a.kind === "person") expect(a.cognome).toBeTruthy();
      else expect(a.nome).toBeUndefined(); // companies carry no person fields
    }
  });

  test("every fixture supplier matches a company anagrafica (nominativo + categoria)", () => {
    for (const detail of Object.values(fx.detailByPeriod)) {
      for (const s of detail.suppliers) {
        const match = fx.anagrafiche.find(
          (a) => a.kind === "company" && a.nominativo === s.nominativo,
        );
        expect(match, `supplier ${s.nominativo} has no anagrafica`).toBeTruthy();
        expect(match!.categoria).toBe(s.categoria);
      }
    }
  });

  test("every Condòmino anagrafica appears in some unit tree", () => {
    const labels: string[] = [];
    const walk = (rows: typeof fx.unitsByPeriod[string]) => {
      for (const r of rows) { labels.push(r.label); walk(r.children ?? []); }
    };
    for (const rows of Object.values(fx.unitsByPeriod)) walk(rows);
    const condomini = fx.anagrafiche.filter((a) => a.categoria === "Condòmino");
    expect(condomini.length).toBeGreaterThan(0);
    for (const a of condomini) {
      expect(
        labels.some((l) => l.includes(a.nominativo)),
        `${a.nominativo} not found in any unit tree`,
      ).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/mock/fixtures.test.ts`
Expected: FAIL — `fx.anagrafiche` / `fx.anagraficaCategories` do not exist.

- [ ] **Step 3: Add the fixtures**

In `apps/web/src/mock/fixtures.ts`: extend the type import with `Anagrafica`, then append at the end of the file:

```ts
/** ---- Anagrafiche (Plan 4) ---- */
/** Legacy masterDataCategory registry (dump-accurate names, alphabetical).
 * Static like calendarLayers; several stay at 0 entries on purpose — the
 * legacy sidebar shows the whole registry with counts. */
export const anagraficaCategories: string[] = [
  "Amministrazione condominiale", "Antincendio", "Assicurazione", "Avvocato",
  "Commercialista", "Condòmino", "Elettricista", "Fabbro", "Fornitura acqua",
  "Fornitura energia elettrica", "Fornitura gas", "Geometra", "Giardiniere",
  "Idraulico", "Impresa di pulizie", "Istituto di credito", "Manutenzione ascensori",
];

/** Studio-wide registry. Companies/codes/P.IVA/addresses transcribed from the dump
 * (company + masterData tables); persons tied to fixture units keep the prototype
 * names so Unità, Rate and Giornale keep telling one story (guarded by fixtures.test). */
export const anagrafiche: Anagrafica[] = [
  // — persone fisiche —
  { id: "ana-alberi", kind: "person", nominativo: "Alberi Dina", categoria: "Condòmino",
    stato: "active", nome: "Dina", cognome: "Alberi", sesso: "f",
    dataNascita: "1955-04-05", luogoNascita: "Udine",
    indirizzo: "Piazza del Duomo, 39, 33100 Udine", codiceFiscale: "LBRRTT55D45L483F" },
  { id: "ana-mauri", kind: "person", nominativo: "Mauri Dina", categoria: "Condòmino",
    stato: "active", nome: "Dina", cognome: "Mauri", sesso: "f",
    indirizzo: "Piazza del Duomo, 39, 33100 Udine", codiceFiscale: "MRALDN62M50L483Q" },
  { id: "ana-picech", kind: "person", nominativo: "Picech Giorgio", categoria: "Condòmino",
    stato: "active", nome: "Giorgio", cognome: "Picech", sesso: "m",
    indirizzo: "Piazza del Duomo, 39, 33100 Udine", codiceFiscale: "PCHGRG58T10L483Z" },
  { id: "ana-rossi", kind: "person", nominativo: "Floreani Tiziano", categoria: "Condòmino",
    stato: "active", nome: "Tiziano", cognome: "Rossi", sesso: "m", codice: "MROSSI",
    indirizzo: "34071 Nimis (GO)" },
  { id: "ana-savino", kind: "person", nominativo: "Adami Valerio", categoria: "Amministrazione condominiale",
    stato: "active", nome: "Vito", cognome: "Adami", sesso: "m", codice: "ADAMI",
    professione: "Amministratore di condominio", indirizzo: "via Gorghi, 123, 33044 Tarcento",
    note: "Titolare dello Studio Bertoli Amministrazioni." },
  { id: "ana-sfiligoi", kind: "person", nominativo: "Mattiussi Vittorio", categoria: "Amministrazione condominiale",
    stato: "active", nome: "Vittorio", cognome: "Mattiussi", sesso: "m",
    indirizzo: "via Pordenone, 143, 33100 Udine" },
  // — società (fornitori correnti dei condomìni fixture) —
  { id: "ana-acme", kind: "company", nominativo: "Acme Pulizie S.r.l.", categoria: "Impresa di pulizie",
    stato: "active", partitaIva: "02471550301", indirizzo: "via dei Platani, 12, 33100 Udine",
    note: "Contratto pulizie scale in essere per il condominio Saturno." },
  { id: "ana-verdi", kind: "company", nominativo: "Verdi Giardini", categoria: "Giardiniere",
    stato: "active", partitaIva: "01988770304", indirizzo: "via Pradamano, 7, 33100 Udine" },
  { id: "ana-bper", kind: "company", nominativo: "Banca Pop. Emilia Romagna", categoria: "Istituto di credito",
    stato: "active", codice: "BPEMRM", partitaIva: "72415790327",
    indirizzo: "via S. Carlo, 20, 41121 Modena",
    banca: "BPER — Filiale di Udine", iban: "IT60X0542811101000000123456" },
  // — società (candidati fornitore, già nel prototipo) —
  { id: "ana-idraulica", kind: "company", nominativo: "Idraulica Blu S.n.c.", categoria: "Idraulico",
    stato: "active", partitaIva: "01775430309", indirizzo: "via Cividale, 44, 33100 Udine" },
  { id: "ana-elettro", kind: "company", nominativo: "Elettrosistemi Friuli", categoria: "Elettricista",
    stato: "active", partitaIva: "02214550306", indirizzo: "via Buttrio, 9, 33100 Udine" },
  { id: "ana-bianchi", kind: "company", nominativo: "Studio Rag. Bianchi", categoria: "Commercialista",
    stato: "active", codiceFiscale: "01551230307", indirizzo: "piazza Libertà, 3, 33100 Udine" },
  // — società dal dump legacy —
  { id: "ana-friulclean", kind: "company", nominativo: "Zanon Servizi di Pulizia s.n.c.", categoria: "Impresa di pulizie",
    stato: "active", codice: "FCLEAN", partitaIva: "14476590311",
    indirizzo: "Via Mazzini, 48, 33100 Udine" },
  { id: "ana-modesto", kind: "company", nominativo: "Ascensori Castellarin s.a.s.", categoria: "Manutenzione ascensori",
    stato: "active", codice: "MODEST", partitaIva: "91757180301",
    indirizzo: "via dei Gelsi, 101, 33017 Tarcento" },
  { id: "ana-ascoop", kind: "company", nominativo: "Cargnelutti Elevatori s.n.c.", categoria: "Manutenzione ascensori",
    stato: "active", codice: "ASCOOP", partitaIva: "58080030321",
    indirizzo: "via Nievo, 72, 34015 Muggia (TS)" },
  { id: "ana-enel", kind: "company", nominativo: "Energie del Ledra S.p.A.", categoria: "Fornitura energia elettrica",
    stato: "active", codice: "ENERGIE DEL LEDRA" },
  { id: "ana-poiana", kind: "company", nominativo: "Acque Arzino s.n.c.", categoria: "Fornitura acqua",
    stato: "active", codice: "POIANA", indirizzo: "piazza XX Settembre, 84, 33043 Cividale del Friuli" },
  { id: "ana-iris", kind: "company", nominativo: "Acque Fella s.r.l.", categoria: "Fornitura acqua",
    stato: "active", codice: "IRIS", partitaIva: "74864820316", indirizzo: "Via della Roggia, 107, 34170 Gorizia" },
  { id: "ana-isogas", kind: "company", nominativo: "Natisone Gas S.p.A.", categoria: "Fornitura gas",
    stato: "active", codice: "Natisone Gas", partitaIva: "57281340307", indirizzo: "Via della Roggia, 107, 34170 Gorizia" },
  { id: "ana-lloyd", kind: "company", nominativo: "Mutua Assicuratrice del Livenza", categoria: "Assicurazione",
    stato: "active", codice: "LYDADR", partitaIva: "11075030327", indirizzo: "via San Rocco, 134, 34123 Trieste" },
  { id: "ana-reale", kind: "company", nominativo: "Minisini Assicurazioni s.r.l.", categoria: "Assicurazione",
    stato: "active", codice: "RLMTAS", partitaIva: "16318210933", indirizzo: "Via San Rocco, 62, 33010 Tavagnacco" },
  { id: "ana-carifvg", kind: "company", nominativo: "Cassa di Risparmio del Natisone S.p.A.", categoria: "Istituto di credito",
    stato: "active", codice: "CARIFVG", codiceFiscale: "57337330310", partitaIva: "14036590314",
    indirizzo: "Via delle Acacie, 128, 34170 Gorizia" },
  { id: "ana-amga", kind: "company", nominativo: "Fella Gas S.p.A.", categoria: "Fornitura gas",
    stato: "archived", codice: "AMGAUD" }, // archived in the dump too
];
```

- [ ] **Step 4: Align existing supplier categorie to the dump registry**

In `detailByPeriod` (same file), update the three supplier rows — categoria values must match `anagraficaCategories` entries:

- `s1` (Acme Pulizie S.r.l.): `categoria: "Pulizie"` → `categoria: "Impresa di pulizie"`
- `s2` (Verdi Giardini): `categoria: "Giardinaggio"` → `categoria: "Giardiniere"`
- `s3` (Banca Pop. Emilia Romagna): `categoria: "Banca"` → `categoria: "Istituto di credito"`

Leave `supplierCandidates` untouched for now (their categorie — Idraulico, Elettricista, Commercialista — already match; the export itself is removed in Task 10).

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @cl/web exec vitest run src/mock/fixtures.test.ts` — expected PASS.
Run: `pnpm --filter @cl/web test` — expected all PASS. If any test asserted the old categoria strings ("Pulizie"/"Giardinaggio"/"Banca" **as supplier categoria**, not as account or layer names), update it to the new value — but a grep of the current suite shows none do.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/mock/fixtures.ts apps/web/src/mock/fixtures.test.ts
git commit -m "feat(web): anagrafiche fixtures — dump-accurate registry + supplier categoria alignment"
```

---

### Task 3: MockStore — anagrafiche collection, CRUD, links derivation

**Files:**
- Modify: `apps/web/src/mock/MockStore.ts`
- Modify: `apps/web/src/mock/MockStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/mock/MockStore.test.ts`. The file already defines a synchronous `latest()` helper at the top and uses `it()` — reuse both:

```ts
describe("anagrafiche slice", () => {
  it("serves the fixture registry and the static categories", () => {
    const s = new MockStore();
    expect(latest(s.anagrafiche())).toHaveLength(23);
    expect(latest(s.anagraficaCategories())).toContain("Istituto di credito");
  });
  it("addAnagrafica rejects an unknown categoria and leaves state untouched", () => {
    const s = new MockStore();
    expect(() => s.addAnagrafica({
      id: "ana-x", kind: "company", nominativo: "X", categoria: "Categoria inventata", stato: "active",
    })).toThrow("Categoria sconosciuta");
    expect(latest(s.anagrafiche())).toHaveLength(23);
  });
  it("add, edit and remove round-trip; edit merges without dropping fields", () => {
    const s = new MockStore();
    s.addAnagrafica({ id: "ana-zorzi", kind: "person", nominativo: "Zorzi Anna",
      categoria: "Condòmino", stato: "active", nome: "Anna", cognome: "Zorzi" });
    s.editAnagrafica("ana-zorzi", { professione: "Architetto" });
    const z = latest(s.anagrafiche()).find((a) => a.id === "ana-zorzi")!;
    expect(z.professione).toBe("Architetto");
    expect(z.nominativo).toBe("Zorzi Anna"); // merge preserves untouched fields
    s.removeAnagrafica("ana-zorzi");
    expect(latest(s.anagrafiche()).some((a) => a.id === "ana-zorzi")).toBe(false);
  });
  it("anagraficaLinks finds supplier and condòmino cross-references", () => {
    const s = new MockStore();
    // ana-bper: supplier of Saturno 2011 (detail fixture s3 has the same nominativo)
    expect(latest(s.anagraficaLinks("ana-bper"))).toEqual([{
      condominio: "Saturno", esercizio: "2011 (Ordinario)",
      ruolo: "Fornitore", dettaglio: "Istituto di credito",
    }]);
    // ana-alberi: resident in the Saturno unit tree
    const alberi = latest(s.anagraficaLinks("ana-alberi"));
    expect(alberi).toHaveLength(1);
    expect(alberi[0]).toMatchObject({ condominio: "Saturno", ruolo: "Condòmino" });
    expect(alberi[0]!.dettaglio).toContain("Alberi Dina");
    // Lloyd has no link anywhere; unknown ids yield []
    expect(latest(s.anagraficaLinks("ana-lloyd"))).toEqual([]);
    expect(latest(s.anagraficaLinks("nope"))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/mock/MockStore.test.ts`
Expected: FAIL — `store.anagrafiche` is not a function.

- [ ] **Step 3: Implement in `MockStore.ts`**

Extend the type import with `Anagrafica, AnagraficaLink`. Add the subject next to `calendar$`:

```ts
  private anagrafiche$ = new BehaviorSubject<Anagrafica[]>(fx.anagrafiche);
```

Add the reads next to `calendarEvents()`:

```ts
  anagrafiche(): Observable<Anagrafica[]> { return this.anagrafiche$.asObservable(); }
  anagraficaCategories(): Observable<string[]> { return of(fx.anagraficaCategories); } // static registry
  anagraficaLinks(anagraficaId: Id): Observable<AnagraficaLink[]> {
    return combineLatest([this.anagrafiche$, this.tree$, this.details$, this.units$]).pipe(
      map(([anas, tree, details, units]) => {
        const a = anas.find((x) => x.id === anagraficaId);
        if (!a) return [];
        const links: AnagraficaLink[] = [];
        for (const cond of tree) {
          const condominio = cond.name.split(" (")[0] ?? cond.name;
          for (const p of cond.periods) {
            const supplier = (details[p.id]?.suppliers ?? []).find((s) => s.nominativo === a.nominativo);
            if (supplier) {
              links.push({ condominio, esercizio: p.name, ruolo: "Fornitore", dettaglio: supplier.categoria });
            }
            const row = findRowLabel(units[p.id] ?? [], a.nominativo);
            if (row) links.push({ condominio, esercizio: p.name, ruolo: "Condòmino", dettaglio: row });
          }
        }
        return links;
      }),
    );
  }
```

Add the module-level helper at the bottom of `MockStore.ts` (after the class):

```ts
/** First unit-tree row whose label mentions the nominativo (prototype-grade
 * name matching: fixtures guarantee supplier/resident names match the registry). */
function findRowLabel(rows: UnitRow[], nominativo: string): string | null {
  for (const r of rows) {
    if (r.label.includes(nominativo)) return r.label;
    const inChild = findRowLabel(r.children ?? [], nominativo);
    if (inChild) return inChild;
  }
  return null;
}
```

Add the CRUD next to the calendar commands:

```ts
  addAnagrafica(a: Anagrafica): void {
    if (!fx.anagraficaCategories.includes(a.categoria))
      throw new Error(`Categoria sconosciuta: ${a.categoria}`);
    this.anagrafiche$.next([...this.anagrafiche$.getValue(), a]);
  }
  editAnagrafica(id: Id, patch: Partial<Anagrafica>): void {
    this.anagrafiche$.next(this.anagrafiche$.getValue().map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  removeAnagrafica(id: Id): void {
    this.anagrafiche$.next(this.anagrafiche$.getValue().filter((a) => a.id !== id));
  }
```

Note: `findRowLabel` matches the FIRST row containing the name. Unit rows like `"A01 - Alberi Dina (PR)"` are visited before their resident children, so the dettaglio is the unit label — that is the desired display.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @cl/web exec vitest run src/mock/MockStore.test.ts` — expected PASS.
Run: `pnpm --filter @cl/web test` — expected all PASS. (`pnpm -r typecheck` is still red for `@cl/web` until Task 4 — expected.)

Note: `MockStore` now satisfies the `MockDataSource` data methods but `createAppRuntime` still misses the runtime hooks — the red typecheck moves from two files to one.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/mock/MockStore.ts apps/web/src/mock/MockStore.test.ts
git commit -m "feat(web): MockStore anagrafiche — collection, validated CRUD, cross-reference links"
```

---
### Task 4: Runtime — anagrafiche slice (filters as one derived stream)

**Files:**
- Modify: `apps/web/src/runtime/createAppRuntime.ts`
- Modify: `apps/web/src/runtime/runtime.test.tsx`

After this task `pnpm -r typecheck` is GREEN across all packages again.

- [ ] **Step 1: Write the failing probe tests**

Append to `apps/web/src/runtime/runtime.test.tsx` (same probe-component style as `CalendarProbe`):

```tsx
function AnagraficheProbe() {
  const rt = useAppRuntime();
  const rows = rt.useAnagrafiche();
  const all = rt.useAllAnagrafiche();
  const counts = rt.useAnagraficaCategoryCounts();
  const links = rt.useAnagraficaLinks();
  const selected = rt.useSelectedAnagrafica();
  return (
    <div>
      <button onClick={() => rt.setAnagSearch("clean")}>search</button>
      <button onClick={() => rt.setAnagKind("person")}>persone</button>
      <button onClick={() => rt.setAnagStato("archived")}>archiviate</button>
      <button onClick={() => rt.setAnagCategory("Assicurazione")}>cat</button>
      <button onClick={() => rt.selectAnagrafica("ana-bper")}>pick</button>
      <span data-testid="n">{rows.length}</span>
      <span data-testid="all">{all.length}</span>
      <span data-testid="first">{rows[0]?.id ?? "none"}</span>
      <span data-testid="credito">{counts["Istituto di credito"] ?? 0}</span>
      <span data-testid="links">{links.map((l) => l.ruolo).join(",") || "none"}</span>
      <span data-testid="sel">{selected ?? "none"}</span>
    </div>
  );
}

test("anagrafiche slice: full registry by default, sorted by nominativo", () => {
  render(<AppRuntimeProvider><AnagraficheProbe /></AppRuntimeProvider>);
  expect(screen.getByTestId("n")).toHaveTextContent("23");
  expect(screen.getByTestId("all")).toHaveTextContent("23");
  expect(screen.getByTestId("first")).toHaveTextContent("ana-acme"); // "Acme Pulizie S.r.l." sorts first
  expect(screen.getByTestId("credito")).toHaveTextContent("2"); // BPER + CariFVG
});

test("anagrafiche slice: search, tipo and categoria filters compose; counts stay unfiltered", async () => {
  render(<AppRuntimeProvider><AnagraficheProbe /></AppRuntimeProvider>);
  await act(async () => { screen.getByText("search").click(); });
  expect(screen.getByTestId("n")).toHaveTextContent("1"); // Zanon Servizi di Pulizia only
  expect(screen.getByTestId("first")).toHaveTextContent("ana-friulclean");
  await act(async () => { screen.getByText("persone").click(); });
  expect(screen.getByTestId("n")).toHaveTextContent("0"); // "clean" matches no person
  expect(screen.getByTestId("credito")).toHaveTextContent("2"); // counts ignore filters
});

test("anagrafiche slice: stato filter narrows to archived records", async () => {
  render(<AppRuntimeProvider><AnagraficheProbe /></AppRuntimeProvider>);
  await act(async () => { screen.getByText("archiviate").click(); });
  expect(screen.getByTestId("n")).toHaveTextContent("1"); // only AMGA is archived
  expect(screen.getByTestId("first")).toHaveTextContent("ana-amga");
});

test("anagrafiche slice: categoria filter and selected-anagrafica links", async () => {
  render(<AppRuntimeProvider><AnagraficheProbe /></AppRuntimeProvider>);
  await act(async () => { screen.getByText("cat").click(); });
  expect(screen.getByTestId("n")).toHaveTextContent("2"); // Lloyd + Reale Mutua
  expect(screen.getByTestId("links")).toHaveTextContent("none");
  await act(async () => { screen.getByText("pick").click(); });
  expect(screen.getByTestId("sel")).toHaveTextContent("ana-bper");
  expect(screen.getByTestId("links")).toHaveTextContent("Fornitore");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/runtime/runtime.test.tsx`
Expected: FAIL — `rt.useAnagrafiche` is not a function.

- [ ] **Step 3: Implement the slice in `createAppRuntime.ts`**

Extend the type import with `AnagraficaKindFilter, AnagraficaStatusFilter`. After the Calendario slice block, add:

```ts
  // Anagrafiche slice. Studio-wide like the calendar (legacy masterData has no
  // condominium FK); search + tipo + stato + categoria compose as ONE derived
  // stream (spec §5.2) so the grid, paging and counts all read consistent state.
  const anagSearch$ = new BehaviorSubject<string>("");
  const anagKind$ = new BehaviorSubject<AnagraficaKindFilter>("tutte");
  const anagStato$ = new BehaviorSubject<AnagraficaStatusFilter>("tutte");
  const anagCategory$ = new BehaviorSubject<string | null>(null);
  const selectedAnagrafica$ = new BehaviorSubject<Id | null>(null);
  const [useAnagSearch] = bind(anagSearch$, "");
  const [useAnagKind] = bind(anagKind$, "tutte");
  const [useAnagStato] = bind(anagStato$, "tutte");
  const [useAnagCategory] = bind(anagCategory$, null);
  const [useSelectedAnagrafica] = bind(selectedAnagrafica$, null);
  const [useAllAnagrafiche] = bind(data.anagrafiche(), []);
  const [useAnagraficaCategories] = bind(data.anagraficaCategories(), []);
  const [useAnagrafiche] = bind(
    combineLatest([data.anagrafiche(), anagSearch$, anagKind$, anagStato$, anagCategory$]).pipe(
      map(([all, search, kind, stato, category]) => {
        const q = search.trim().toLowerCase();
        return all
          .filter((a) => kind === "tutte" || a.kind === kind)
          .filter((a) => stato === "tutte" || a.stato === stato)
          .filter((a) => category === null || a.categoria === category)
          .filter((a) => !q ||
            [a.nominativo, a.codice, a.codiceFiscale, a.partitaIva, a.indirizzo]
              .some((f) => f?.toLowerCase().includes(q)))
          .sort((a, b) => a.nominativo.localeCompare(b.nominativo));
      }),
    ),
    [],
  );
  const [useAnagraficaCategoryCounts] = bind(
    data.anagrafiche().pipe(map((all) => {
      const counts: Record<string, number> = {};
      for (const a of all) counts[a.categoria] = (counts[a.categoria] ?? 0) + 1;
      return counts;
    })),
    {},
  );
  const [useAnagraficaLinks] = bind(
    selectedAnagrafica$.pipe(switchMap((id) => (id ? data.anagraficaLinks(id) : of([])))),
    [],
  );
```

And in the returned object (after `useAllCalendarEvents`):

```ts
    useAnagSearch, setAnagSearch: (q) => anagSearch$.next(q),
    useAnagKind, setAnagKind: (k) => anagKind$.next(k),
    useAnagStato, setAnagStato: (s) => anagStato$.next(s),
    useAnagCategory, setAnagCategory: (c) => anagCategory$.next(c),
    useSelectedAnagrafica, selectAnagrafica: (id) => selectedAnagrafica$.next(id),
    useAnagrafiche, useAllAnagrafiche,
    useAnagraficaCategories, useAnagraficaCategoryCounts,
    useAnagraficaLinks,
```

Filter setters deliberately do NOT clear `selectedAnagrafica$`: the module derives its `selected` from the FILTERED list, so a filtered-out selection simply disables the toolbar (same ghost-selection treatment as Calendario, pinned by a Task 9 test).

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @cl/web exec vitest run src/runtime/runtime.test.tsx` — expected PASS.
Run: `pnpm -r typecheck` — expected PASS in ALL packages (red window closed).
Run: `pnpm --filter @cl/web test` — expected all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/runtime/createAppRuntime.ts apps/web/src/runtime/runtime.test.tsx
git commit -m "feat(web): runtime anagrafiche slice — composed filters, category counts, selected links"
```

---

### Task 5: Labels + FilterPane (sidebar: Filtro Anagrafiche + Categorie)

**Files:**
- Create: `apps/web/src/modules/anagrafiche/labels.ts`
- Create: `apps/web/src/modules/anagrafiche/FilterPane.tsx`
- Create: `apps/web/src/modules/anagrafiche/FilterPane.module.css`
- Test: `apps/web/src/modules/anagrafiche/FilterPane.test.tsx`

Presentational only — props in, callbacks out (like `MonthGrid`). Legacy labels from the it_IT bundle: "Filtro Anagrafiche", "Parola Chiave", "Persone fisiche", "Società", "Status Anagrafiche", "Categorie Anagrafiche".

- [ ] **Step 1: Create `labels.ts`**

```ts
import type { AnagraficaKind, AnagraficaStatus } from "@cl/application";

/** Italian display labels (legacy it_IT bundle wording). */
export const KIND_LABELS: Record<AnagraficaKind, string> = {
  person: "Persona fisica",
  company: "Società",
};
export const STATO_LABELS: Record<AnagraficaStatus, string> = {
  active: "Attiva",
  archived: "Archiviata",
};
export const SESSO_LABELS: Record<"m" | "f", string> = {
  m: "Maschio",
  f: "Femmina",
};
```

- [ ] **Step 2: Write the failing tests**

`FilterPane.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { FilterPane } from "./FilterPane";

const noop = () => {};
const base = {
  search: "", onSearch: noop,
  kind: "tutte" as const, onKind: noop,
  stato: "tutte" as const, onStato: noop,
  category: null, onCategory: noop,
  categories: ["Assicurazione", "Idraulico"],
  counts: { Assicurazione: 2 },
};

test("renders search, tipo and stato selects and the category list with counts", () => {
  render(<FilterPane {...base} />);
  expect(screen.getByText("Filtro Anagrafiche")).toBeInTheDocument();
  expect(screen.getByRole("searchbox")).toBeInTheDocument();
  expect(screen.getByLabelText("Tipo")).toBeInTheDocument();
  expect(screen.getByLabelText("Stato")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Assicurazione (2)" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Idraulico (0)" })).toBeInTheDocument(); // missing count → 0
});

test("clicking a category selects it; clicking the active one clears", async () => {
  const onCategory = vi.fn();
  const { rerender } = render(<FilterPane {...base} onCategory={onCategory} />);
  await userEvent.click(screen.getByRole("button", { name: "Assicurazione (2)" }));
  expect(onCategory).toHaveBeenCalledWith("Assicurazione");
  rerender(<FilterPane {...base} category="Assicurazione" onCategory={onCategory} />);
  await userEvent.click(screen.getByRole("button", { name: "Assicurazione (2)" }));
  expect(onCategory).toHaveBeenLastCalledWith(null); // toggle off
});

test("tipo, stato and search forward changes", async () => {
  const onKind = vi.fn(); const onStato = vi.fn(); const onSearch = vi.fn();
  render(<FilterPane {...base} onKind={onKind} onStato={onStato} onSearch={onSearch} />);
  await userEvent.selectOptions(screen.getByLabelText("Tipo"), "person");
  expect(onKind).toHaveBeenCalledWith("person");
  await userEvent.selectOptions(screen.getByLabelText("Stato"), "archived");
  expect(onStato).toHaveBeenCalledWith("archived");
  await userEvent.type(screen.getByRole("searchbox"), "x");
  expect(onSearch).toHaveBeenCalledWith("x");
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/modules/anagrafiche/FilterPane.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `FilterPane.tsx`**

```tsx
import type { AnagraficaKindFilter, AnagraficaStatusFilter } from "@cl/application";
import { SearchBox } from "../../components/common/SearchBox";
import styles from "./FilterPane.module.css";

/** Legacy MasterDataFilter + MasterDataCategories sidebar. Presentational:
 * filter state lives in the runtime slice; this pane only renders and forwards. */
export function FilterPane({
  search, onSearch, kind, onKind, stato, onStato, category, onCategory, categories, counts,
}: {
  search: string; onSearch: (q: string) => void;
  kind: AnagraficaKindFilter; onKind: (k: AnagraficaKindFilter) => void;
  stato: AnagraficaStatusFilter; onStato: (s: AnagraficaStatusFilter) => void;
  category: string | null; onCategory: (c: string | null) => void;
  categories: string[]; counts: Record<string, number>;
}) {
  return (
    <aside className={styles.pane}>
      <div className={styles.paneTitle}>Filtro Anagrafiche</div>
      <div className={styles.fields}>
        <label className={styles.field}>Parola chiave
          <SearchBox value={search} onChange={onSearch} placeholder="Cerca…" />
        </label>
        <label className={styles.field}>Tipo
          <select aria-label="Tipo" value={kind}
            onChange={(e) => onKind(e.target.value as AnagraficaKindFilter)}>
            <option value="tutte">Tutte</option>
            <option value="person">Persone fisiche</option>
            <option value="company">Società</option>
          </select>
        </label>
        <label className={styles.field}>Stato
          <select aria-label="Stato" value={stato}
            onChange={(e) => onStato(e.target.value as AnagraficaStatusFilter)}>
            <option value="tutte">Tutte</option>
            <option value="active">Attive</option>
            <option value="archived">Archiviate</option>
          </select>
        </label>
      </div>
      <div className={styles.paneTitle}>Categorie Anagrafiche</div>
      <ul className={styles.catList}>
        {categories.map((c) => (
          <li key={c}>
            <button
              className={`${styles.cat} ${category === c ? styles.catActive : ""}`}
              onClick={() => onCategory(category === c ? null : c)}>
              {c} ({counts[c] ?? 0})
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

`FilterPane.module.css` (real tokens only):

```css
.pane {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-panel);
  overflow: hidden;
  min-height: 0;
}
.paneTitle {
  background: var(--surface-panel-header);
  font-size: var(--fs-xs);
  font-weight: var(--fw-bold);
  padding: var(--sp-1) var(--sp-2);
  border-bottom: 1px solid var(--border-strong);
}
.fields {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-2);
}
.field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  font-size: var(--fs-xs);
  color: var(--text-secondary);
}
.catList {
  list-style: none;
  margin: 0;
  padding: var(--sp-1);
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.cat {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: none;
  font-size: var(--fs-xs);
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text-secondary);
}
.cat:hover { background: var(--surface-row-hover); }
.catActive { background: var(--surface-row-selected); font-weight: var(--fw-bold); }
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @cl/web exec vitest run src/modules/anagrafiche/FilterPane.test.tsx` — expected PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/anagrafiche/
git commit -m "feat(web): anagrafiche labels + FilterPane sidebar (keyword, tipo, categorie with counts)"
```

---

### Task 6: AnagraficheGrid (flat table, row selection)

**Files:**
- Modify: `apps/web/src/components/common/Icon.tsx` (add `user` glyph)
- Create: `apps/web/src/modules/anagrafiche/AnagraficheGrid.tsx`
- Create: `apps/web/src/modules/anagrafiche/AnagraficheGrid.module.css`
- Test: `apps/web/src/modules/anagrafiche/AnagraficheGrid.test.tsx`

Columns mirror legacy `MasterDataList` (screenshot `50`): Nominativo / Ragione Sociale, Codice, Tipo (icon), Stato, Indirizzo di riferimento, Codice Fiscale, Partita IVA, Categoria. Flat table (the registry is not a tree) — same table idiom as `DayPanel`, not `TreeTable`.

- [ ] **Step 1: Add the `user` glyph to `Icon.tsx`**

In `apps/web/src/components/common/Icon.tsx`: add `User` to the lucide-react import list and `user: User,` to `MAP` (alongside the existing `building: Building2`).

- [ ] **Step 2: Write the failing tests**

`AnagraficheGrid.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { Anagrafica } from "@cl/application";
import { AnagraficheGrid } from "./AnagraficheGrid";

const rows: Anagrafica[] = [
  { id: "ana-p", kind: "person", nominativo: "Floreani Tiziano", categoria: "Condòmino",
    stato: "active", codiceFiscale: "RSSMRA70A01H501X" },
  { id: "ana-c", kind: "company", nominativo: "Energie del Ledra S.p.A.", categoria: "Fornitura energia elettrica",
    stato: "archived", codice: "ENERGIE DEL LEDRA", partitaIva: "00811720580", indirizzo: "viale Regina Margherita, 137, Roma" },
];

test("renders one row per anagrafica with legacy columns and em-dash blanks", () => {
  render(<AnagraficheGrid rows={rows} selectedId={null} onSelect={() => {}} />);
  expect(screen.getByText("Nominativo / Ragione Sociale")).toBeInTheDocument();
  expect(screen.getByText("Floreani Tiziano")).toBeInTheDocument();
  expect(screen.getByText("RSSMRA70A01H501X")).toBeInTheDocument();
  expect(screen.getByText("Archiviata")).toBeInTheDocument();   // STATO_LABELS
  expect(screen.getByLabelText("Persona fisica")).toBeInTheDocument(); // tipo icon a11y
  expect(screen.getByLabelText("Società")).toBeInTheDocument();
  // person row: codice, indirizzo and partita IVA are blank → "—"
  const personRow = screen.getByText("Floreani Tiziano").closest("tr")!;
  expect(personRow).toHaveTextContent("—");
});

test("clicking a row selects it; the selected row is marked", async () => {
  const onSelect = vi.fn();
  render(<AnagraficheGrid rows={rows} selectedId="ana-c" onSelect={onSelect} />);
  await userEvent.click(screen.getByText("Floreani Tiziano"));
  expect(onSelect).toHaveBeenCalledWith("ana-p");
  expect(screen.getByText("Energie del Ledra S.p.A.").closest("tr")!.className).toContain("selected");
});

test("empty list renders the placeholder row", () => {
  render(<AnagraficheGrid rows={[]} selectedId={null} onSelect={() => {}} />);
  expect(screen.getByText("Nessuna anagrafica trovata.")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/modules/anagrafiche/AnagraficheGrid.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `AnagraficheGrid.tsx`**

```tsx
import type { Anagrafica, Id } from "@cl/application";
import { Icon } from "../../components/common/Icon";
import { KIND_LABELS, STATO_LABELS } from "./labels";
import styles from "./AnagraficheGrid.module.css";

const dash = (v?: string) => v ?? "—";

/** Legacy "Elenco Anagrafiche" grid. Flat (the registry is not a tree);
 * paging is the caller's concern — this renders exactly the rows it receives. */
export function AnagraficheGrid({ rows, selectedId, onSelect }: {
  rows: Anagrafica[]; selectedId: Id | null; onSelect: (id: Id) => void;
}) {
  return (
    <table className={styles.table} aria-label="Elenco Anagrafiche">
      <thead>
        <tr>
          <th>Nominativo / Ragione Sociale</th>
          <th>Codice</th>
          <th>Tipo</th>
          <th>Stato</th>
          <th>Indirizzo di riferimento</th>
          <th>Codice Fiscale</th>
          <th>Partita IVA</th>
          <th>Categoria</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr><td colSpan={8} className={styles.empty}>Nessuna anagrafica trovata.</td></tr>
        )}
        {rows.map((a) => (
          <tr key={a.id}
            className={a.id === selectedId ? styles.selected : undefined}
            onClick={() => onSelect(a.id)}>
            <td className={styles.name}>{a.nominativo}</td>
            <td>{dash(a.codice)}</td>
            <td className={styles.tipo}>
              <span role="img" aria-label={KIND_LABELS[a.kind]}>
                <Icon name={a.kind === "person" ? "user" : "building"} size={14} />
              </span>
            </td>
            <td>{STATO_LABELS[a.stato]}</td>
            <td>{dash(a.indirizzo)}</td>
            <td>{dash(a.codiceFiscale)}</td>
            <td>{dash(a.partitaIva)}</td>
            <td>{a.categoria}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

`AnagraficheGrid.module.css`:

```css
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}
.table th {
  background: var(--surface-panel-header);
  font-size: var(--fs-xs);
  font-weight: var(--fw-bold);
  text-align: left;
  padding: var(--sp-1) var(--sp-2);
  border-bottom: 1px solid var(--border-strong);
  position: sticky;
  top: 0;
}
.table td {
  padding: var(--sp-1) var(--sp-2);
  border-bottom: 1px solid var(--border-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}
.table tbody tr { cursor: pointer; }
.table tbody tr:hover { background: var(--surface-row-hover); }
.selected, .table tbody tr.selected:hover { background: var(--surface-row-selected); }
.name { font-weight: var(--fw-bold); }
.tipo { text-align: center; color: var(--text-secondary); }
.empty {
  text-align: center;
  color: var(--text-muted);
  padding: var(--sp-4);
  cursor: default;
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @cl/web exec vitest run src/modules/anagrafiche/AnagraficheGrid.test.tsx` — expected PASS.
Run: `pnpm --filter @cl/web test` — expected all PASS (Icon change is additive).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/common/Icon.tsx apps/web/src/modules/anagrafiche/AnagraficheGrid.tsx apps/web/src/modules/anagrafiche/AnagraficheGrid.module.css apps/web/src/modules/anagrafiche/AnagraficheGrid.test.tsx
git commit -m "feat(web): AnagraficheGrid — legacy column set, tipo icons, row selection"
```

---

### Task 7: Detail tabs — Dettagli Anagrafica + Anagrafiche Condomini

**Files:**
- Create: `apps/web/src/modules/anagrafiche/AnagraficaDetails.tsx`
- Create: `apps/web/src/modules/anagrafiche/AnagraficaDetails.module.css`
- Create: `apps/web/src/modules/anagrafiche/AnagraficaLinks.tsx` (shares `AnagraficaDetails.module.css`)
- Test: `apps/web/src/modules/anagrafiche/AnagraficaDetails.test.tsx`
- Test: `apps/web/src/modules/anagrafiche/AnagraficaLinks.test.tsx`

Field groups mirror the legacy detail scrollers (`PersonDetailsScroll` / `CompanyDetailsScroll`, it_IT labels): DATI PERSONA FISICA / DATI SOCIETÀ, DATI UTILI, COORDINATE BANCARIE, NOTE INTERNE.

- [ ] **Step 1: Write the failing tests**

`AnagraficaDetails.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import type { Anagrafica } from "@cl/application";
import { AnagraficaDetails } from "./AnagraficaDetails";

const person: Anagrafica = {
  id: "ana-p", kind: "person", nominativo: "Alberi Dina", categoria: "Condòmino",
  stato: "active", nome: "Dina", cognome: "Alberi", sesso: "f",
  dataNascita: "1955-04-05", luogoNascita: "Udine",
  indirizzo: "Piazza del Duomo, 39, 33100 Udine", codiceFiscale: "LBRRTT55D45L483F",
};
const company: Anagrafica = {
  id: "ana-c", kind: "company", nominativo: "Banca Pop. Emilia Romagna",
  categoria: "Istituto di credito", stato: "active", partitaIva: "72415790327",
  banca: "BPER — Filiale di Udine", iban: "IT60X0542811101000000123456",
  note: "Tesoreria condominiale.",
};

test("person card shows the legacy person group with formatted birth date", () => {
  render(<AnagraficaDetails anagrafica={person} />);
  expect(screen.getByText("DATI PERSONA FISICA")).toBeInTheDocument();
  expect(screen.getByText("Cognome")).toBeInTheDocument();
  expect(screen.getByText("Alberi")).toBeInTheDocument();
  expect(screen.getByText("Femmina")).toBeInTheDocument();      // SESSO_LABELS
  expect(screen.getByText("05/04/1955")).toBeInTheDocument();   // formatItDate
  expect(screen.getByText("Categoria Anagrafica")).toBeInTheDocument();
  expect(screen.queryByText("COORDINATE BANCARIE")).not.toBeInTheDocument(); // no bank data
});

test("company card shows ragione sociale, bank group and notes", () => {
  render(<AnagraficaDetails anagrafica={company} />);
  expect(screen.getByText("DATI SOCIETÀ")).toBeInTheDocument();
  expect(screen.getByText("Ragione Sociale")).toBeInTheDocument();
  expect(screen.getByText("COORDINATE BANCARIE")).toBeInTheDocument();
  expect(screen.getByText("IT60X0542811101000000123456")).toBeInTheDocument();
  expect(screen.getByText("NOTE INTERNE")).toBeInTheDocument();
  expect(screen.getByText("Tesoreria condominiale.")).toBeInTheDocument();
});

test("renders the placeholder when nothing is selected", () => {
  render(<AnagraficaDetails anagrafica={null} />);
  expect(screen.getByText("Nessuna anagrafica selezionata.")).toBeInTheDocument();
});
```

`AnagraficaLinks.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { AnagraficaLinks } from "./AnagraficaLinks";

test("renders one row per link", () => {
  render(<AnagraficaLinks links={[
    { condominio: "Saturno", esercizio: "2011 (Ordinario)", ruolo: "Fornitore", dettaglio: "Istituto di credito" },
    { condominio: "Pozzetto", esercizio: "2010 (Ordinario)", ruolo: "Condòmino", dettaglio: "P01 - Floreani Tiziano" },
  ]} />);
  expect(screen.getByText("Condominio")).toBeInTheDocument();
  expect(screen.getByText("Fornitore")).toBeInTheDocument();
  expect(screen.getByText("P01 - Floreani Tiziano")).toBeInTheDocument();
});

test("renders the empty state when there are no links", () => {
  render(<AnagraficaLinks links={[]} />);
  expect(screen.getByText("Nessun collegamento ai condomini.")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/modules/anagrafiche/AnagraficaDetails.test.tsx src/modules/anagrafiche/AnagraficaLinks.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `AnagraficaDetails.tsx`**

```tsx
import type { Anagrafica } from "@cl/application";
import { FormCard, FieldGroup, Field } from "../../components/layout/FormCard";
import { formatItDate } from "../../recompute/dates";
import { KIND_LABELS, STATO_LABELS, SESSO_LABELS } from "./labels";
import styles from "./AnagraficaDetails.module.css";

/** Legacy "Dettagli Anagrafica" tab: person vs company field card. Read-only. */
export function AnagraficaDetails({ anagrafica: a }: { anagrafica: Anagrafica | null }) {
  if (!a) return <p className={styles.placeholder}>Nessuna anagrafica selezionata.</p>;
  return (
    <FormCard>
      {a.kind === "person" ? (
        <FieldGroup title="DATI PERSONA FISICA">
          <Field label="Nome" value={a.nome} />
          <Field label="Cognome" value={a.cognome} />
          <Field label="Sesso" value={a.sesso ? SESSO_LABELS[a.sesso] : undefined} />
          <Field label="Data di nascita" value={a.dataNascita ? formatItDate(a.dataNascita) : undefined} />
          <Field label="Luogo di nascita" value={a.luogoNascita} />
          <Field label="Professione" value={a.professione} />
        </FieldGroup>
      ) : (
        <FieldGroup title="DATI SOCIETÀ">
          <Field label="Ragione Sociale" value={a.nominativo} />
        </FieldGroup>
      )}
      <FieldGroup title="DATI UTILI">
        <Field label="Codice" value={a.codice} />
        <Field label="Status" value={STATO_LABELS[a.stato]} />
        <Field label="Tipologia anagrafica" value={KIND_LABELS[a.kind]} />
        <Field label="Categoria Anagrafica" value={a.categoria} />
        <Field label="Codice Fiscale" value={a.codiceFiscale} />
        <Field label="Partita IVA" value={a.partitaIva} />
        <Field label="Indirizzo di riferimento" value={a.indirizzo} />
      </FieldGroup>
      {(a.banca || a.iban) && (
        <FieldGroup title="COORDINATE BANCARIE">
          <Field label="Banca / Filiale" value={a.banca} />
          <Field label="IBAN" value={a.iban} />
        </FieldGroup>
      )}
      {a.note && (
        <FieldGroup title="NOTE INTERNE">
          <Field label="Note" value={a.note} />
        </FieldGroup>
      )}
    </FormCard>
  );
}
```

- [ ] **Step 4: Implement `AnagraficaLinks.tsx`**

```tsx
import type { AnagraficaLink } from "@cl/application";
import styles from "./AnagraficaDetails.module.css";

/** Legacy "Anagrafiche Condomini" tab: read-only cross-references derived by the store. */
export function AnagraficaLinks({ links }: { links: AnagraficaLink[] }) {
  if (links.length === 0) {
    return <p className={styles.placeholder}>Nessun collegamento ai condomini.</p>;
  }
  return (
    <table className={styles.links}>
      <thead>
        <tr><th>Condominio</th><th>Esercizio</th><th>Ruolo</th><th>Dettaglio</th></tr>
      </thead>
      <tbody>
        {links.map((l, i) => (
          <tr key={i}>
            <td>{l.condominio}</td><td>{l.esercizio}</td><td>{l.ruolo}</td><td>{l.dettaglio}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

`AnagraficaDetails.module.css`:

```css
.placeholder {
  color: var(--text-muted);
  font-size: var(--fs-sm);
  padding: var(--sp-3);
  margin: 0;
}
.links {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}
.links th {
  background: var(--surface-panel-header);
  font-size: var(--fs-xs);
  font-weight: var(--fw-bold);
  text-align: left;
  padding: var(--sp-1) var(--sp-2);
  border-bottom: 1px solid var(--border-strong);
}
.links td {
  padding: var(--sp-1) var(--sp-2);
  border-bottom: 1px solid var(--border-strong);
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @cl/web exec vitest run src/modules/anagrafiche/AnagraficaDetails.test.tsx src/modules/anagrafiche/AnagraficaLinks.test.tsx` — expected PASS.

Note: `formatItDate` lives in `apps/web/src/recompute/dates.ts` and renders dd/mm/yyyy — same helper the rate dialogs use. If its signature differs (e.g. takes a Date), adapt the call, not the helper.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/anagrafiche/AnagraficaDetails.tsx apps/web/src/modules/anagrafiche/AnagraficaDetails.module.css apps/web/src/modules/anagrafiche/AnagraficaLinks.tsx apps/web/src/modules/anagrafiche/AnagraficaDetails.test.tsx apps/web/src/modules/anagrafiche/AnagraficaLinks.test.tsx
git commit -m "feat(web): anagrafica detail tabs — person/company card + condomini cross-references"
```

---
### Task 8: AnagraficaDialog — Aggiungi/Modifica Persona & Azienda

**Files:**
- Create: `apps/web/src/modules/anagrafiche/AnagraficaDialog.tsx`
- Test: `apps/web/src/modules/anagrafiche/AnagraficaDialog.test.tsx`

Single-step `WizardDialog`, `submitLabel="Salva"`, veto-close on command errors, once-per-open seeding via `wasOpen` ref — exactly the `EventDialog` conventions (read `apps/web/src/modules/calendario/EventDialog.tsx` first and mirror its structure).

- [ ] **Step 1: Write the failing tests**

`AnagraficaDialog.test.tsx`:

```tsx
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Anagrafica, AnagraficaKind } from "@cl/application";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../components/common/Toast";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { AnagraficaDialog, uniqueAnagraficaId } from "./AnagraficaDialog";

function Host({ kind, editingId }: { kind: AnagraficaKind; editingId?: string }) {
  const rt = useAppRuntime();
  const all = rt.useAllAnagrafiche();
  const categories = rt.useAnagraficaCategories();
  const [open, setOpen] = useState(true);
  return (
    <>
      <AnagraficaDialog open={open} onOpenChange={setOpen} kind={kind}
        editing={all.find((a) => a.id === editingId) ?? null}
        categories={categories} anagrafiche={all} />
      <div data-testid="all">{all.map((a) => `${a.id}:${a.nominativo}`).join("|")}</div>
    </>
  );
}
const setup = (props: { kind: AnagraficaKind; editingId?: string }) => render(
  <AppRuntimeProvider><ToastProvider><Host {...props} /></ToastProvider></AppRuntimeProvider>,
);

test("uniqueAnagraficaId slugs, strips accents, falls back and suffixes", () => {
  const existing = [{ id: "ana-rossi-mario" }, { id: "ana-rossi-mario-2" }] as Anagrafica[];
  expect(uniqueAnagraficaId("Società Nuova", [])).toBe("ana-societa-nuova");
  expect(uniqueAnagraficaId("", [])).toBe("ana-anagrafica");
  expect(uniqueAnagraficaId("Floreani Tiziano", existing)).toBe("ana-rossi-mario-3");
});

test("persona form requires the cognome", async () => {
  setup({ kind: "person" });
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText("Inserire il cognome")).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toBeInTheDocument(); // veto: still open
});

test("azienda form requires the ragione sociale, then adds with a slug id", async () => {
  setup({ kind: "company" });
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText("Inserire la ragione sociale")).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Ragione sociale"), "Officina Nuova S.r.l.");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(screen.getByTestId("all").textContent).toContain("ana-officina-nuova-s-r-l:Officina Nuova S.r.l.");
});

test("edit seeds the form from the record and recomputes the nominativo", async () => {
  setup({ kind: "person", editingId: "ana-rossi" });
  expect(screen.getByLabelText("Cognome")).toHaveValue("Rossi");
  await userEvent.clear(screen.getByLabelText("Nome"));
  await userEvent.type(screen.getByLabelText("Nome"), "Maria");
  await userEvent.type(screen.getByLabelText("Professione"), "Insegnante");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(screen.getByTestId("all").textContent).toContain("ana-rossi:Rossi Maria"); // id stable, name recomputed
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/modules/anagrafiche/AnagraficaDialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `AnagraficaDialog.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import type { Anagrafica, AnagraficaKind, AnagraficaStatus } from "@cl/application";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, SelectField, DateField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { useToast } from "../../components/common/Toast";

export function uniqueAnagraficaId(nominativo: string, existing: Anagrafica[]): string {
  const slug = nominativo.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents: "Società" → "societa"
    .replace(/\W+/g, "-").replace(/^-+|-+$/g, "");
  const base = `ana-${slug || "anagrafica"}`;
  const taken = new Set(existing.map((a) => a.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

const opt = (v: string) => v.trim() || undefined;

export function AnagraficaDialog({ open, onOpenChange, kind, editing, categories, anagrafiche }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  /** form variant for add; when editing, the record's own kind wins */
  kind: AnagraficaKind;
  editing: Anagrafica | null;
  categories: string[];
  /** FULL registry — id-uniqueness pool (filtered list would miss collisions) */
  anagrafiche: Anagrafica[];
}) {
  const rt = useAppRuntime();
  const toast = useToast();
  const effKind = editing?.kind ?? kind;
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [sesso, setSesso] = useState("");
  const [dataNascita, setDataNascita] = useState("");
  const [luogoNascita, setLuogoNascita] = useState("");
  const [professione, setProfessione] = useState("");
  const [ragioneSociale, setRagioneSociale] = useState("");
  const [categoria, setCategoria] = useState("");
  const [stato, setStato] = useState<AnagraficaStatus>("active");
  const [codiceFiscale, setCodiceFiscale] = useState("");
  const [partitaIva, setPartitaIva] = useState("");
  const [indirizzo, setIndirizzo] = useState("");
  const [banca, setBanca] = useState("");
  const [iban, setIban] = useState("");
  const [note, setNote] = useState("");
  // seed ONCE per open-transition: prop identity changes while open must not clobber typing
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setNome(editing?.nome ?? "");
      setCognome(editing?.cognome ?? "");
      setSesso(editing?.sesso ?? "");
      setDataNascita(editing?.dataNascita ?? "");
      setLuogoNascita(editing?.luogoNascita ?? "");
      setProfessione(editing?.professione ?? "");
      setRagioneSociale(editing && editing.kind === "company" ? editing.nominativo : "");
      setCategoria(editing?.categoria ?? (effKind === "person" ? "Condòmino" : categories[0] ?? ""));
      setStato(editing?.stato ?? "active");
      setCodiceFiscale(editing?.codiceFiscale ?? "");
      setPartitaIva(editing?.partitaIva ?? "");
      setIndirizzo(editing?.indirizzo ?? "");
      setBanca(editing?.banca ?? "");
      setIban(editing?.iban ?? "");
      setNote(editing?.note ?? "");
    }
    wasOpen.current = open;
  }, [open, editing, effKind, categories]);

  const validate = (): string | null => {
    if (effKind === "person" && !cognome.trim()) return "Inserire il cognome";
    if (effKind === "company" && !ragioneSociale.trim()) return "Inserire la ragione sociale";
    return null;
  };

  const submit = (): void | boolean => {
    const nominativo = effKind === "person"
      ? `${cognome.trim()} ${nome.trim()}`.trim()
      : ragioneSociale.trim();
    const record: Anagrafica = {
      id: editing?.id ?? uniqueAnagraficaId(nominativo, anagrafiche),
      kind: effKind, nominativo, categoria, stato,
      codiceFiscale: opt(codiceFiscale), partitaIva: opt(partitaIva),
      indirizzo: opt(indirizzo), note: opt(note),
      ...(effKind === "person"
        ? { nome: opt(nome), cognome: cognome.trim(),
            sesso: (sesso || undefined) as "m" | "f" | undefined,
            dataNascita: dataNascita || undefined,
            luogoNascita: opt(luogoNascita), professione: opt(professione) }
        : { banca: opt(banca), iban: opt(iban) }),
    };
    try {
      if (editing) {
        const { id: _id, kind: _kind, ...patch } = record; // codice not in the form → preserved by merge
        rt.commands.editAnagrafica(editing.id, patch);
      } else {
        rt.commands.addAnagrafica(record);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  const noun = effKind === "person" ? "Persona" : "Azienda";
  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} submitLabel="Salva"
      title={`${editing ? "Modifica" : "Aggiungi"} ${noun}`}
      onSubmit={submit}
      steps={[{
        title: noun,
        validate,
        content: (
          <div>
            {effKind === "person" ? (
              <>
                <TextField label="Cognome" value={cognome} onChange={setCognome} />
                <TextField label="Nome" value={nome} onChange={setNome} />
                <SelectField label="Sesso" value={sesso} onChange={setSesso}
                  options={[{ value: "", label: "—" }, { value: "m", label: "Maschio" }, { value: "f", label: "Femmina" }]} />
                <DateField label="Data di nascita" value={dataNascita} onChange={setDataNascita} />
                <TextField label="Luogo di nascita" value={luogoNascita} onChange={setLuogoNascita} />
                <TextField label="Professione" value={professione} onChange={setProfessione} />
              </>
            ) : (
              <>
                <TextField label="Ragione sociale" value={ragioneSociale} onChange={setRagioneSociale} />
                <TextField label="Banca / Filiale" value={banca} onChange={setBanca} />
                <TextField label="IBAN" value={iban} onChange={setIban} />
              </>
            )}
            <SelectField label="Categoria" value={categoria} onChange={setCategoria}
              options={categories.map((c) => ({ value: c, label: c }))} />
            <SelectField label="Stato" value={stato} onChange={(v) => setStato(v as AnagraficaStatus)}
              options={[{ value: "active", label: "Attiva" }, { value: "archived", label: "Archiviata" }]} />
            <TextField label="Codice fiscale" value={codiceFiscale} onChange={setCodiceFiscale} />
            <TextField label="Partita IVA" value={partitaIva} onChange={setPartitaIva} />
            <TextField label="Indirizzo" value={indirizzo} onChange={setIndirizzo} />
            <TextField label="Note" value={note} onChange={setNote} />
          </div>
        ),
      }]}
    />
  );
}
```

Edit semantics: the destructured `patch` carries every form-backed field (explicit `undefined` clears a field the user emptied — they were all seeded from the record), while `codice` is absent from the patch entirely, so the store merge preserves it.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @cl/web exec vitest run src/modules/anagrafiche/AnagraficaDialog.test.tsx` — expected PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/anagrafiche/AnagraficaDialog.tsx apps/web/src/modules/anagrafiche/AnagraficaDialog.test.tsx
git commit -m "feat(web): AnagraficaDialog — persona/azienda forms, slug ids, veto-close"
```

---

### Task 9: AnagraficheModule composition + AppShell swap (stub deleted)

**Files:**
- Create: `apps/web/src/modules/anagrafiche/AnagraficheModule.tsx`
- Create: `apps/web/src/modules/anagrafiche/AnagraficheModule.module.css`
- Test: `apps/web/src/modules/anagrafiche/AnagraficheModule.test.tsx`
- Modify: `apps/web/src/components/layout/AppShell.tsx`
- Delete: `apps/web/src/modules/AnagraficheStub.tsx`
- Delete: `apps/web/src/modules/Stub.module.css` (AnagraficheStub was its last consumer — verify with grep before deleting)

- [ ] **Step 1: Write the failing integration tests**

`AnagraficheModule.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../components/common/Toast";
import { AnagraficheModule } from "./AnagraficheModule";

const setup = () => render(
  <AppRuntimeProvider><ToastProvider><AnagraficheModule /></ToastProvider></AppRuntimeProvider>,
);

test("shows the registry paged at 10 rows, sorted by nominativo", async () => {
  setup();
  expect(await screen.findByText("Acme Pulizie S.r.l.")).toBeInTheDocument();
  expect(screen.getByText("pagina 1 di 3")).toBeInTheDocument(); // 23 fixtures / 10
  expect(screen.queryByText("Verdi Giardini")).not.toBeInTheDocument(); // sorts last → page 3
  await userEvent.click(screen.getByLabelText("Ultima pagina"));
  expect(await screen.findByText("Verdi Giardini")).toBeInTheDocument();
});

test("search + categoria filter compose and reset paging (spec §6)", async () => {
  setup();
  await userEvent.click(screen.getByLabelText("Pagina successiva")); // move off page 1 first
  await userEvent.type(screen.getByRole("searchbox"), "clean");
  expect(await screen.findByText("Zanon Servizi di Pulizia s.n.c.")).toBeInTheDocument();
  expect(screen.getByText("pagina 1 di 1")).toBeInTheDocument(); // filter change resets paging
  expect(screen.queryByText("Acme Pulizie S.r.l.")).not.toBeInTheDocument();
  await userEvent.clear(screen.getByRole("searchbox"));
  await userEvent.click(screen.getByRole("button", { name: "Assicurazione (2)" }));
  expect(await screen.findByText("Mutua Assicuratrice del Livenza")).toBeInTheDocument();
  expect(screen.getByText("Minisini Assicurazioni s.r.l.")).toBeInTheDocument();
  expect(screen.queryByText("Acme Pulizie S.r.l.")).not.toBeInTheDocument();
  // clicking the active category clears the filter
  await userEvent.click(screen.getByRole("button", { name: "Assicurazione (2)" }));
  expect(await screen.findByText("Acme Pulizie S.r.l.")).toBeInTheDocument();
});

test("tipo filter narrows to persone fisiche", async () => {
  setup();
  await userEvent.selectOptions(screen.getByLabelText("Tipo"), "person");
  expect(await screen.findByText("Alberi Dina")).toBeInTheDocument();
  expect(screen.getByText("pagina 1 di 1")).toBeInTheDocument(); // 6 persons fit one page
  expect(screen.queryByText("Acme Pulizie S.r.l.")).not.toBeInTheDocument();
});

test("stato filter narrows to archived records", async () => {
  setup();
  await userEvent.selectOptions(screen.getByLabelText("Stato"), "archived");
  expect(await screen.findByText("Fella Gas S.p.A.")).toBeInTheDocument();
  expect(screen.queryByText("Acme Pulizie S.r.l.")).not.toBeInTheDocument();
});

test("selecting a row fills the detail card and the condomini links tab", async () => {
  setup();
  await userEvent.click(await screen.findByText("Banca Pop. Emilia Romagna"));
  expect(await screen.findByText("DATI SOCIETÀ")).toBeInTheDocument();
  expect(screen.getByText("IT60X0542811101000000123456")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "Anagrafiche Condomini" }));
  expect(await screen.findByText("Fornitore")).toBeInTheDocument();
  expect(screen.getByText("2011 (Ordinario)")).toBeInTheDocument();
});

test("add persona end-to-end: dialog → grid (spec §6)", async () => {
  setup();
  await userEvent.click(screen.getByLabelText("Aggiungi persona"));
  await userEvent.type(screen.getByLabelText("Cognome"), "Zorzi");
  await userEvent.type(screen.getByLabelText("Nome"), "Anna");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  await userEvent.type(screen.getByRole("searchbox"), "zorzi");
  expect(await screen.findByText("Zorzi Anna")).toBeInTheDocument();
});

test("ghost selection: filtering out the selected row disables Modifica/Rimuovi", async () => {
  setup();
  await userEvent.click(await screen.findByText("Acme Pulizie S.r.l."));
  expect(screen.getByLabelText("Modifica anagrafica")).toBeEnabled();
  await userEvent.type(screen.getByRole("searchbox"), "clean");
  expect(screen.getByLabelText("Modifica anagrafica")).toBeDisabled();
  expect(screen.getByLabelText("Rimuovi anagrafica")).toBeDisabled();
});

test("rimuovi deletes the selected row and clears the selection", async () => {
  setup();
  await userEvent.click(await screen.findByText("Acme Pulizie S.r.l."));
  await userEvent.click(screen.getByLabelText("Rimuovi anagrafica"));
  expect(screen.queryByText("Acme Pulizie S.r.l.")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Modifica anagrafica")).toBeDisabled();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/modules/anagrafiche/AnagraficheModule.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `AnagraficheModule.tsx`**

```tsx
import { useEffect, useState } from "react";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { DetailPanel } from "../../components/layout/DetailPanel";
import { PagingBar } from "../../components/common/PagingBar";
import { FilterPane } from "./FilterPane";
import { AnagraficheGrid } from "./AnagraficheGrid";
import { AnagraficaDetails } from "./AnagraficaDetails";
import { AnagraficaLinks } from "./AnagraficaLinks";
import { AnagraficaDialog } from "./AnagraficaDialog";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { useToast } from "../../components/common/Toast";
import styles from "./AnagraficheModule.module.css";

const PAGE_SIZES = [10, 20, 50];

export function AnagraficheModule() {
  const rt = useAppRuntime();
  const toast = useToast();
  const rows = rt.useAnagrafiche();
  const all = rt.useAllAnagrafiche();
  const categories = rt.useAnagraficaCategories();
  const counts = rt.useAnagraficaCategoryCounts();
  const search = rt.useAnagSearch();
  const kind = rt.useAnagKind();
  const stato = rt.useAnagStato();
  const category = rt.useAnagCategory();
  const selectedId = rt.useSelectedAnagrafica();
  const links = rt.useAnagraficaLinks();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialog, setDialog] = useState<"person" | "company" | "edit" | null>(null);
  const stub = () => toast("Non disponibile nel prototipo");

  // any filter change resets paging — a narrower list may have fewer pages
  useEffect(() => { setPage(1); }, [search, kind, stato, category, pageSize]);

  // ghost selection: a filtered-out id yields null → toolbar disables (Plan-3 convention)
  const selected = rows.find((a) => a.id === selectedId) ?? null;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visible = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const actions = [
    { icon: "add", label: "Aggiungi persona", primary: true, onClick: () => setDialog("person") },
    { icon: "add", label: "Aggiungi azienda", onClick: () => setDialog("company") },
    { icon: "edit", label: "Modifica anagrafica", disabled: !selected, onClick: () => setDialog("edit") },
    { icon: "remove", label: "Rimuovi anagrafica", disabled: !selected,
      onClick: () => { if (selected) { rt.commands.removeAnagrafica(selected.id); rt.selectAnagrafica(null); } } },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa", onClick: stub },
    { icon: "pdf", label: "PDF", onClick: stub },
  ];

  return (
    <SectionPanel
      title="Anagrafiche" actions={actions} count={rows.length} countNoun="anagrafiche"
      legend={<div>Registro unico dello studio: persone fisiche e società. Le categorie a sinistra filtrano l'elenco.</div>}
      toolbarRight={
        <label className={styles.pageSize}>Righe{" "}
          <select aria-label="Righe per pagina" value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      }
    >
      <div className={styles.layout}>
        <FilterPane search={search} onSearch={rt.setAnagSearch}
          kind={kind} onKind={rt.setAnagKind}
          stato={stato} onStato={rt.setAnagStato}
          category={category} onCategory={rt.setAnagCategory}
          categories={categories} counts={counts} />
        <div className={styles.main}>
          <div className={styles.gridWrap}>
            <AnagraficheGrid rows={visible} selectedId={selectedId} onSelect={rt.selectAnagrafica} />
          </div>
          <PagingBar page={safePage} pageCount={pageCount} onPage={setPage} />
          <div className={styles.detail}>
            <DetailPanel tabs={[
              { id: "dettagli", label: "Dettagli Anagrafica",
                content: <AnagraficaDetails anagrafica={selected} /> },
              { id: "condomini", label: "Anagrafiche Condomini",
                content: <AnagraficaLinks links={selected ? links : []} /> },
            ]} />
          </div>
        </div>
      </div>
      <AnagraficaDialog
        open={dialog !== null}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        kind={dialog === "company" ? "company" : dialog === "edit" ? (selected?.kind ?? "person") : "person"}
        editing={dialog === "edit" ? selected : null}
        categories={categories}
        anagrafiche={all}
      />
    </SectionPanel>
  );
}
```

`AnagraficheModule.module.css`:

```css
.layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: var(--sp-2);
  height: 100%;
  min-height: 0;
}
.main {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  min-height: 0;
}
.gridWrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
}
.detail { height: 260px; min-height: 0; overflow: auto; }
.pageSize { font-size: var(--fs-xs); color: var(--text-secondary); }
```

If `ActionToolbar`'s `ToolbarAction` type complains about the literal action objects, match the exact shape used in `CalendarioModule.tsx` (same `{ icon, label, primary?, disabled?, onClick?, sep? }` idiom).

- [ ] **Step 4: Swap the shell mount and delete the stub**

In `apps/web/src/components/layout/AppShell.tsx`:
- Replace `import { AnagraficheStub } from "../../modules/AnagraficheStub";` with `import { AnagraficheModule } from "../../modules/anagrafiche/AnagraficheModule";`
- Replace `{module === "anagrafiche" && <AnagraficheStub />}` with `{module === "anagrafiche" && <AnagraficheModule />}`

Then: `grep -rn "AnagraficheStub\|Stub.module" apps/web/src` — expected: no remaining references. Delete `apps/web/src/modules/AnagraficheStub.tsx` and `apps/web/src/modules/Stub.module.css`.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `pnpm --filter @cl/web exec vitest run src/modules/anagrafiche/AnagraficheModule.test.tsx` — expected PASS.
Run: `pnpm --filter @cl/web test` — expected all PASS.
Run: `pnpm -r typecheck` — expected PASS.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src
git commit -m "feat(web): Anagrafiche module — filter sidebar, paged grid, detail tabs, CRUD; stub removed"
```

---

### Task 10: Fornitori picker through the port (supplierCandidates removed)

**Files:**
- Modify: `apps/web/src/sections/dati/DatiDialogs.tsx` (SupplierDialog)
- Modify: `apps/web/src/mock/fixtures.ts` (delete `supplierCandidates`)
- Modify: `apps/web/src/sections/dati/DatiCondominioSection.test.tsx`

Closes the last sanctioned fixture import in a component (Plan-2 deferred item): the Fornitori add-dialog now picks from the anagrafiche registry via the runtime — the spec's "add (pick from anagrafiche via ComboBox dialog)" (§4.1) as originally intended.

- [ ] **Step 1: Update the test first**

In `DatiCondominioSection.test.tsx`, test `"adds a condominium and a supplier; toggles an F24"`, replace the supplier-add block:

```tsx
  // add supplier from the anagrafiche registry (companies only)
  await userEvent.click(screen.getByText("Fornitori del Condominio"));
  await userEvent.click(screen.getByLabelText("Aggiungi fornitore"));
  // duplicate veto: BPER is already a fixture supplier of sat-2011
  await userEvent.selectOptions(screen.getByLabelText("Anagrafica"), "ana-bper");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText("Fornitore già presente")).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Anagrafica"), "ana-idraulica");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText(/Idraulica Blu/)).toBeInTheDocument();
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/sections/dati/DatiCondominioSection.test.tsx`
Expected: FAIL — the select has no option `ana-bper` (it still lists `cand-*`).

- [ ] **Step 3: Rewrite `SupplierDialog` in `DatiDialogs.tsx`**

Remove `import { supplierCandidates } from "../../mock/fixtures";`. Replace the body:

```tsx
export function SupplierDialog({ open, onOpenChange, periodId }: {
  open: boolean; onOpenChange: (o: boolean) => void; periodId: string | null;
}) {
  const rt = useAppRuntime();
  const detail = rt.useCondominiumDetail();
  // active companies from the studio registry — the legacy picker surface
  const companies = rt.useAllAnagrafiche()
    .filter((a) => a.kind === "company" && a.stato === "active");
  const [candidateId, setCandidateId] = useState("");
  useEffect(() => { if (open) setCandidateId(""); }, [open]);
  const candidate = companies.find((c) => c.id === candidateId) ?? null;
  const submit = () => {
    if (!periodId || !candidate) return;
    rt.commands.addSupplier(periodId, {
      id: `s-${candidate.id}`, nominativo: candidate.nominativo, categoria: candidate.categoria,
    });
  };
  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva" title="Aggiungi Fornitore"
      steps={[{
        title: "Fornitore",
        validate: () =>
          !candidate ? "Seleziona il fornitore"
          // match by nominativo: fixture suppliers predate registry-derived ids
          : detail?.suppliers.some((s) => s.nominativo === candidate.nominativo) ? "Fornitore già presente"
          : null,
        content: (
          <SelectField label="Anagrafica" value={candidateId} onChange={setCandidateId}
            options={[{ value: "", label: "—" },
              ...companies.map((c) => ({ value: c.id, label: `${c.nominativo} (${c.categoria})` }))]} />
        ),
      }]}
    />
  );
}
```

- [ ] **Step 4: Delete `supplierCandidates` from `fixtures.ts`**

Remove the `supplierCandidates` export and its doc comment. Then `grep -rn "supplierCandidates" apps/web packages` — expected: no matches. Drop `SupplierRow` from the fixtures import list if now unused.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @cl/web exec vitest run src/sections/dati/DatiCondominioSection.test.tsx` — expected PASS.
Run: `pnpm --filter @cl/web test && pnpm -r typecheck` — expected all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/sections/dati/ apps/web/src/mock/fixtures.ts
git commit -m "refactor(web): fornitori picker reads anagrafiche via the port; supplierCandidates fixture removed"
```

---

### Task 11: README + screenshot-parity pass (spec §7.4 close-out)

**Files:**
- Modify: `apps/web/README.md`

- [ ] **Step 1: Add the Anagrafiche section**

After the "## Calendario (Plan 3)" section, add:

```markdown
## Anagrafiche (Plan 4)

Registro unico dello studio (legacy MasterData), non legato alla selezione del condominio:

- **Sidebar filtro** — parola chiave (nominativo, codice, CF, P.IVA, indirizzo), tipo
  (Persone fisiche / Società) e l'elenco «Categorie Anagrafiche» con i conteggi; i filtri
  si compongono in un unico stream derivato nel runtime.
- **Elenco** — colonne legacy (Nominativo/Ragione Sociale, Codice, Tipo, Stato, Indirizzo,
  CF, P.IVA, Categoria), ordinato per nominativo, con paginazione (10/20/50 righe).
- **Dettaglio** — tab «Dettagli Anagrafica» (scheda persona o società, coordinate bancarie,
  note) e «Anagrafiche Condomini» (incroci derivati: dove l'anagrafica è fornitore o condòmino).
- **CRUD** — Aggiungi Persona / Aggiungi Azienda / Modifica / Rimuovi; id deterministici
  (slug + suffisso), validazione categoria nel mock store.
- Il dialog «Aggiungi Fornitore» dei Condomini ora pesca dalle società del registro (via port).
```

- [ ] **Step 2: Add the parity table**

Append a final section:

```markdown
## Parità con il legacy (screenshot pass)

Riferimento: `old/screenshots/presentazione Vittorio/`. Ogni schermata ha un corrispettivo
modernizzato; le stampe/PDF restano stub dichiarati (fuori scope da spec).

| Screenshot | Corrispettivo nel prototipo |
|---|---|
| 01 calendario | Modulo Calendario: griglia mese, pannello giorno, CRUD scadenze, filtro Competenza |
| 02 dati condominio — scheda | Condomini → Dati: scheda + colonne economiche (Liquidità…Tot. dovuto) |
| 03 dati condominio — fornitori | Condomini → Dati, tab Fornitori (aggiungi da anagrafiche / rimuovi) |
| 04 unità — scheda | Condomini → Unità: albero unità + scheda |
| 05–07 unità — condomini add/edit | Dialoghi Aggiungi/Modifica Condòmino |
| 08 subentri | Wizard Subentro (chiusura + successore) |
| 09 gerarchia condominio | Selettore «Raggruppa righe per» |
| 10–15 tabelle — riparto prev./cons. | Condomini → Tabelle: griglie riparto con riga arrotondamento |
| 16 edit inline coefficienti | CoefficientInput inline con ricalcolo live |
| 17 conti — scheda | Condomini → Conti: albero con R/d, Tabelle, Restr. competenza |
| 18 conti — mastrino | Tab Mastrino (Data, Descrizione, Dare, Avere, Saldo progressivo) |
| 19 configura conti funzionali | Dialogo «Configura conti funzionali» |
| 20 stampe bilanci | Stub dichiarato (toast «Non disponibile nel prototipo») |
| 21–22 conti patrimoniali / costi-ricavi | Stesso albero Conti (raggruppamenti fixture) |
| 23 editing inline preventivo | Edit inline Preventivo sui conti spesa |
| 24–25 specifica conto di costi | Dialogo conto spesa con mappatura tabelle |
| 26 libro giornale | Condomini → Giornale: righe espandibili, paginazione, colonna Partita |
| 27–28 inserimento fattura | Wizard Registrazione Fattura |
| 29 / 39 saldi iniziali | Wizard Saldi Iniziali (quadratura live) |
| 30 scritture contabili | Wizard Scrittura Contabile |
| 31–33 incasso | Wizard Incasso (rate aperte → conto liquidità → Versato) |
| 34–35 rate | Condomini → Rate: edit inline, flag bloccata, wizard Crea Rate |
| 36–38, 40–46, 48 ritagli | Dettagli delle stesse schermate Conti/Tabelle/Giornale |
| 47 riparto — box collassato | Box collassabili nella griglia riparto |
| 50 anagrafiche — tutto | Modulo Anagrafiche (questo piano) |
```

Verify each row's claim against the codebase before committing (the test-suite names are the
inventory: every feature cited has a test). Correct any row that overstates.

- [ ] **Step 3: Final verification**

Run: `pnpm --filter @cl/web test` — expected: all green (record the final test count).
Run: `pnpm -r typecheck` — expected PASS.
Run: `pnpm --filter @cl/web build` — expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add apps/web/README.md
git commit -m "docs(web): README — Anagrafiche capabilities + legacy screenshot-parity table; Plan 4 complete"
```

---

## Out of scope (unchanged from the spec)

Real backend/persistence/auth; PDF & report generation; real file upload; Assemblee module; real accounting math. Also out of scope for this plan: anagrafica file attachments (`MasterDataUploadFiles`), access accounts (`AccessAccount*`), cross-relations between anagrafiche (`MasterDataCrossRelation`), variations archive — the legacy tabs not in screenshot `50`'s primary surface.
