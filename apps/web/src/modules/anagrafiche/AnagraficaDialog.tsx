import { useEffect, useRef, useState } from "react";
import type { Anagrafica, AnagraficaKind, AnagraficaStatus } from "@cl/application";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, SelectField, DateField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { useToast } from "../../components/common/Toast";

export function uniqueAnagraficaId(nominativo: string, existing: Anagrafica[]): string {
  const slug = nominativo.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip accents: "Società" → "societa"
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
  // seed ONCE per open-transition (or when the editing record first arrives after async delivery).
  // Track the last-seeded (open, editingId) pair so that:
  //   • closing the dialog resets seeded state → re-seed on next open
  //   • prop identity changes while the user is typing do NOT clobber their input
  //   • async rxjs delivery (editing null → real record on first render) still seeds correctly
  const seeded = useRef<{ open: boolean; editingId: string | null }>({ open: false, editingId: null });
  useEffect(() => {
    const editingId = editing?.id ?? null;
    const needsSeed =
      (open && !seeded.current.open) ||                         // closed → open transition
      (open && seeded.current.editingId !== editingId) ||       // editing id changed while open (async delivery)
      (open && seeded.current.open && !categoria && categories.length > 0); // categories arrived after empty seed
    if (needsSeed) {
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
    seeded.current = { open, editingId };
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
