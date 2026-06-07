import {
  Home, Plus, Pencil, Trash2, Printer, FileText, Sheet, RefreshCw,
  Search, Calendar, Building2, Users, Info, ChevronRight, ChevronDown,
  LogOut, Globe, SunMoon, type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  home: Home, add: Plus, edit: Pencil, remove: Trash2, print: Printer,
  pdf: FileText, excel: Sheet, refresh: RefreshCw, search: Search,
  calendar: Calendar, building: Building2, users: Users, info: Info,
  chevronRight: ChevronRight, chevronDown: ChevronDown, logout: LogOut,
  lang: Globe, theme: SunMoon,
};
export function Icon({ name, size = 16 }: { name: keyof typeof MAP | string; size?: number }) {
  const C = MAP[name] ?? Info;
  return <C size={size} aria-hidden />;
}
