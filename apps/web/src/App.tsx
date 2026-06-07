import { AppRuntimeProvider } from "./runtime/AppRuntimeProvider";
import { AppShell } from "./components/layout/AppShell";

export function App() {
  return (
    <AppRuntimeProvider>
      <AppShell />
    </AppRuntimeProvider>
  );
}
