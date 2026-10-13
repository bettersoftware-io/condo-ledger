import { X } from "lucide-react";
import type { ReactElement } from "react";

import { useViewModel } from "@cl/react-bindings";

import { TESTIDS } from "../testids.ts";

import "./ToastHost.css";

/** The app's notices, bottom right, each with a ✕ that clears it. */
export function ToastHost(): ReactElement {
  const { useNotices } = useViewModel();
  const { notices, clear } = useNotices();

  function clearingNotice(id: number): () => void {
    return (): void => {
      clear(id);
    };
  }

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {notices.map((notice) => {
        return (
          <div key={notice.id} className="toast" data-testid={TESTIDS.toast}>
            <span className="toast-text">{notice.text}</span>
            <button
              type="button"
              className="toast-dismiss"
              data-testid={TESTIDS.toastDismiss}
              aria-label="Dismiss"
              onClick={clearingNotice(notice.id)}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
