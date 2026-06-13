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
