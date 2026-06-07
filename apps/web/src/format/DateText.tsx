export function DateText({ iso }: { iso: string | null }) {
  if (!iso) return <span>—</span>;
  const d = new Date(iso);
  return <span>{d.toLocaleDateString("it-IT")}</span>;
}
