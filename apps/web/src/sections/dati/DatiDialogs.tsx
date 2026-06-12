import { useEffect, useState } from "react";
import { fromCents } from "@cl/domain";
import type { CondominiumNode } from "@cl/application";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, DateField, SelectField, MoneyField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { supplierCandidates } from "../../mock/fixtures";

export function CondominiumDialog({ open, onOpenChange, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: CondominiumNode | null;
}) {
  const rt = useAppRuntime();
  const tree = rt.useCondominiumTree();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<CondominiumNode["type"]>("regular");
  useEffect(() => {
    if (open) { setCode(editing?.code ?? ""); setName(editing?.name ?? ""); setType(editing?.type ?? "regular"); }
  }, [open, editing]);
  const submit = () => {
    if (editing) { rt.commands.editCondominium(editing.id, { code, name, type }); return; }
    const slug = `c-${code.toLowerCase()}`;
    const taken = new Set(tree.map((n) => n.id));
    let id = slug;
    for (let n = 2; taken.has(id); n++) id = `${slug}-${n}`;
    rt.commands.addCondominium({ id, code, name, type, periods: [] });
  };
  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva"
      title={editing ? "Modifica Condominio" : "Aggiungi Condominio"}
      steps={[{
        title: "Anagrafica",
        validate: () => (!code.trim() ? "Inserisci il codice" : !name.trim() ? "Inserisci l'intestazione" : null),
        content: (
          <div>
            <TextField label="Codice" value={code} onChange={setCode} />
            <TextField label="Intestazione (con indirizzo)" value={name} onChange={setName} />
            <SelectField label="Tipo" value={type} onChange={(v) => setType(v as CondominiumNode["type"])}
              options={[{ value: "regular", label: "Condominio" }, { value: "super", label: "Supercondominio" }, { value: "residence", label: "Residence" }]} />
          </div>
        ),
      }]}
    />
  );
}

export function PeriodDialog({ open, onOpenChange, condominiumId }: {
  open: boolean; onOpenChange: (o: boolean) => void; condominiumId: string | null;
}) {
  const rt = useAppRuntime();
  const tree = rt.useCondominiumTree();
  const [year, setYear] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  useEffect(() => { if (open) { setYear(""); setStart(""); setEnd(""); } }, [open]);
  const submit = () => {
    if (!condominiumId) return;
    rt.commands.addPeriod(condominiumId, {
      id: `${condominiumId}-${year}`, name: `${year} (Ordinario)`, type: "ordinary",
      closed: false, start, end,
    });
  };
  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva" title="Aggiungi Gestione"
      steps={[{
        title: "Gestione",
        validate: () =>
          !/^\d{4}$/.test(year) ? "Anno non valido"
          : tree.find((c) => c.id === condominiumId)?.periods.some((p) => p.id === `${condominiumId}-${year}`) ? "Gestione già presente per quell'anno"
          : !start || !end ? "Inserisci il periodo" : null,
        content: (
          <div>
            <TextField label="Anno" value={year} onChange={setYear} type="number" />
            <DateField label="Inizio" value={start} onChange={setStart} />
            <DateField label="Fine" value={end} onChange={setEnd} />
          </div>
        ),
      }]}
    />
  );
}

export function SupplierDialog({ open, onOpenChange, periodId }: {
  open: boolean; onOpenChange: (o: boolean) => void; periodId: string | null;
}) {
  const rt = useAppRuntime();
  const detail = rt.useCondominiumDetail();
  const [candidateId, setCandidateId] = useState("");
  useEffect(() => { if (open) setCandidateId(""); }, [open]);
  const submit = () => {
    const cand = supplierCandidates.find((c) => c.id === candidateId);
    if (!periodId || !cand) return;
    rt.commands.addSupplier(periodId, { ...cand, id: `s-${cand.id}` });
  };
  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva" title="Aggiungi Fornitore"
      steps={[{
        title: "Fornitore",
        validate: () =>
          !candidateId ? "Seleziona il fornitore"
          : detail?.suppliers.some((s) => s.id === `s-${candidateId}`) ? "Fornitore già presente" : null,
        content: (
          <SelectField label="Anagrafica" value={candidateId} onChange={setCandidateId}
            options={[{ value: "", label: "—" }, ...supplierCandidates.map((c) => ({ value: c.id, label: `${c.nominativo} (${c.categoria})` }))]} />
        ),
      }]}
    />
  );
}

export function F24Dialog({ open, onOpenChange, periodId }: {
  open: boolean; onOpenChange: (o: boolean) => void; periodId: string | null;
}) {
  const rt = useAppRuntime();
  const f24s = rt.useF24s();
  const [descrizione, setDescrizione] = useState("");
  const [scadenza, setScadenza] = useState("");
  const [importoCents, setImportoCents] = useState(0);
  useEffect(() => { if (open) { setDescrizione(""); setScadenza(""); setImportoCents(0); } }, [open]);
  const submit = () => {
    if (!periodId) return;
    const slug = `f24-${descrizione.toLowerCase().replace(/\W+/g, "-")}`;
    const taken = new Set(f24s.map((f) => f.id));
    let id = slug;
    for (let n = 2; taken.has(id); n++) id = `${slug}-${n}`;
    rt.commands.addF24(periodId, { id, descrizione, scadenza, importo: fromCents(importoCents), stato: "da pagare" });
  };
  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva" title="Aggiungi F24"
      steps={[{
        title: "F24",
        validate: () => (!descrizione.trim() ? "Inserisci la descrizione" : !scadenza ? "Inserisci la scadenza" : importoCents <= 0 ? "Importo non valido" : null),
        content: (
          <div>
            <TextField label="Descrizione" value={descrizione} onChange={setDescrizione} />
            <DateField label="Scadenza" value={scadenza} onChange={setScadenza} />
            <MoneyField label="Importo" cents={importoCents} onChange={setImportoCents} />
          </div>
        ),
      }]}
    />
  );
}
