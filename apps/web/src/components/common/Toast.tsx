import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import styles from "./SmallControls.module.css";

const ToastContext = createContext<((msg: string) => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg && <div className={styles.toast} role="status">{msg}</div>}
    </ToastContext.Provider>
  );
}

export function useToast(): (msg: string) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast requires <ToastProvider>");
  return ctx;
}
