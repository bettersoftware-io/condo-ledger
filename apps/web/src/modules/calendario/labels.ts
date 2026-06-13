import type { CalendarPriority, CalendarStatus } from "@cl/application";

export const STATUS_LABELS: Record<CalendarStatus, string> = {
  new: "Nuova", closed: "Chiusa", cancelled: "Annullata",
};
export const PRIORITY_LABELS: Record<CalendarPriority, string> = {
  idle: "Nessuna", low: "Bassa", medium: "Media", high: "Alta", critical: "Critica",
};
