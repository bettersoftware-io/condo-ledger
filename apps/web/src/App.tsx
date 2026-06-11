import { AppRuntimeProvider } from "./runtime/AppRuntimeProvider";
import { AppShell } from "./components/layout/AppShell";
import { ToastProvider } from "./components/common/Toast";

export function App() {
  return (
    <AppRuntimeProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AppRuntimeProvider>
  );
}
